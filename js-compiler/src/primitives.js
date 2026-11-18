import { printf } from 'fast-printf';
import { concat, divide, every, filter, find, first, get, groupBy, gt, gte, includes, isArray, isEqual, isNil, join, keyBy, keys, lt, lte, map, mapValues, max, merge, min, multiply,
    omit, orderBy, pick, reduce, round, some, split, subtract, sum, tail, take, takeWhile, uniqWith, values, zipObject, zipWith } from 'lodash-es'

/**
 * A problem found while a program runs, e.g. an operand that is missing.
 * `path` is a JSON Pointer to the offending node of the program, `code` a stable identifier.
 */
export class LambdaJSONRuntimeError extends Error {
    constructor(code, path, message) {
        super(`${message} (at ${path || '/'})`);
        this.name = 'LambdaJSONRuntimeError';
        this.code = code;
        this.path = path;
    }
}

/**
 * Primitives come in three shapes:
 *  - a function `f => x => …`: the argument is compiled as one expression `f` (positional);
 *  - `{ params, impl }`: named arguments, `params` lists them (`fn` required, `over=#` defaults
 *    to the input, `as?` optional); `impl` receives an object of compiled arguments;
 *  - `{ special }`: a special form, `special(rawArgument, context)` compiles what it needs itself.
 */
export const named = (params, impl, extra = {}) => ({ params, impl, ...extra });
export const special = (form, extra = {}) => ({ special: form, ...extra });

/**
 * Calls a compiled lambda with the arguments of a callback. Without `as` the lambda's input `#`
 * is `input` (by default the first argument); with `as` the arguments are bound to the names
 * (read as `@name`) and `#` stays the input of the enclosing expression.
 */
export const call = (fn, as, x, args, input = args[0]) => as === undefined
    ? fn({ ...x, input })
    : fn({ ...x, vars: { ...x.vars, ...zipObject(as, args) } });

const lambda = (fn, as, x) => (...args) => call(fn, as, x, args);

const toStr = v => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);

const variadic = (name, empty, decides) => special((args, { compile }) => {
    if (!isArray(args)) {
        const f = compile(args);
        return x => {
            const vs = f(x);
            return vs.length === 0 ? empty : vs.find(decides) ?? vs[vs.length - 1];
        };
    }
    const fs = args.map((a, i) => compile(a, i));
    return x => {
        let v = empty;
        for (const f of fs) {
            v = f(x);
            if (decides(v)) return v;
        }
        return v;
    };
}, { description: `${name}: [a, b, …], short-circuits` });

/**
 * Arithmetic and ordering need values: an operand that is null or undefined (typically a path
 * missing in the input) fails with the path of the call instead of flowing on silently.
 */
const strict = (name, impl) => special((args, { compile, path }) => {
    const f = compile(args);
    return x => {
        const operands = f(x);
        const missing = isArray(operands) ? operands.findIndex(isNil) : isNil(operands) ? 0 : -1;
        if (missing >= 0) {
            throw new LambdaJSONRuntimeError('missing-operand', path,
                `${name} got ${operands?.[missing] === null ? 'null' : 'undefined'} as ${isArray(operands) ? `operand ${missing}` : 'its operand'}; a path in the input is probably missing`);
        }
        return impl(operands);
    };
});

const sort = direction => named(['by?', 'collection=#', 'as?'], ({ by, collection, as }) => x =>
    orderBy(collection(x), by ? [v => call(by, as, x, [v])] : undefined, [direction]));

const primitiveTable = {
    $let: true,
    $literal: special(value => () => value),
    $: f => x => v => f({ ...x, input: v }),
    $in: f => x => f(x),
    $return: f => x => f(x),
    $apply: named(['fn', 'to=#', 'as?'], ({ fn, to, as }) => x => call(fn, as, x, [to(x)])),
    $pipeline: f => x => reduce(f(x), (a, g) => g(a), x.input),

    $if: special((args, { compile, fail }) => {
        if (!isArray(args) || args.length < 2 || args.length > 3) fail('takes [test, then] or [test, then, else]');
        const [test, then, otherwise] = args.map((a, i) => compile(a, i));
        return x => test(x) ? then(x) : otherwise ? otherwise(x) : null;
    }),
    $cond: special((args, { compile, fail }) => {
        if (!isArray(args) || !args.every(c => isArray(c) && c.length === 2)) {
            fail('takes clauses [[test, value], …]; a last clause ["else", value] always matches');
        }
        const clauses = args.map((c, i) => [compile(c[0], i, 0), compile(c[1], i, 1)]);
        return x => {
            for (const [test, value] of clauses) {
                if (test(x)) return value(x);
            }
            return null;
        };
    }),
    $and: variadic('$and', true, v => !v),
    $or: variadic('$or', false, v => !!v),
    $not: f => x => !f(x),
    $negate: f => x => !f(x),

    $eq: f => x => isEqual(...f(x)),
    $neq: f => x => !isEqual(...f(x)),
    $lt: strict('$lt', v => lt(...v)),
    $lte: strict('$lte', v => lte(...v)),
    $gt: strict('$gt', v => gt(...v)),
    $gte: strict('$gte', v => gte(...v)),

    $sum: strict('$sum', v => sum(v)),
    $subtract: strict('$subtract', v => subtract(...v)),
    $multiply: strict('$multiply', v => multiply(...v)),
    $divide: strict('$divide', v => divide(...v)),

    $map: named(['fn', 'over=#', 'as?'], ({ fn, over, as }) => x => map(over(x), lambda(fn, as, x))),
    $mapValues: named(['fn', 'of=#', 'as?'], ({ fn, of, as }) => x => mapValues(of(x), lambda(fn, as, x))),
    $filter: named(['predicate', 'collection=#', 'as?'], ({ predicate, collection, as }) => x => filter(collection(x), lambda(predicate, as, x))),
    $any: named(['predicate', 'collection=#', 'as?'], ({ predicate, collection, as }) => x => some(collection(x), lambda(predicate, as, x))),
    $all: named(['predicate', 'collection=#', 'as?'], ({ predicate, collection, as }) => x => every(collection(x), lambda(predicate, as, x))),
    $group: named(['by', 'collection=#', 'as?'], ({ by, collection, as }) => x => groupBy(collection(x), v => call(by, as, x, [v]))),
    $toDictionary: named(['by', 'collection=#', 'as?'], ({ by, collection, as }) => x => keyBy(collection(x), v => call(by, as, x, [v]))),
    $take: named(['while?', 'count?', 'from=#', 'as?'], ({ while: whileFn, count, from, as }) => x => {
        let y = from(x);
        y = whileFn ? takeWhile(y, v => call(whileFn, as, x, [v])) : y;
        y = count ? take(y, count(x)) : y;
        return y;
    }),
    $zip: named(['with?', 'sequences=#', 'as?'], ({ with: withFn, sequences, as }) => x => {
        const [as_, bs] = sequences(x);
        return zipWith(as_, bs, (a, b) => withFn ? call(withFn, as, x, [a, b], [a, b]) : [a, b]);
    }),
    $fold: named(['with', 'init?', 'collection=#', 'as?'], ({ with: withFn, init, collection, as }) => {
        const step = x => (a, v) => call(withFn, as, x, [a, v], [a, v]);
        return init
            ? x => reduce(collection(x), step(x), init(x))
            : x => reduce(collection(x), step(x));
    }),
    $ascending: sort('asc'),
    $descending: sort('desc'),

    $head: f => x => first(f(x)),
    $tail: f => x => tail(f(x)),
    $concat: f => x => concat(...f(x)),
    $keys: f => x => keys(f(x)),
    $values: f => x => values(f(x)),
    $merge: f => x => merge({}, ...f(x)),
    $coalesce: f => x => f(x).find(v => v != null),
    $get: named(['object=#', 'path'], ({ object, path }) => x => get(object(x), path(x))),
    $includes: named(['collection=#', 'value'], ({ collection, value }) => x => includes(collection(x), value(x))),

    $str: f => x => { const v = f(x); return isArray(v) ? v.map(toStr).join('') : toStr(v); },
    $join: named(['separator?', 'strings=#'], ({ separator = () => '', strings }) => x => join(strings(x), separator(x))),
    $split: named(['separator', 'string=#'], ({ separator, string }) => x => split(string(x), separator(x))),
    $match: named(['pattern', 'string=#'], ({ pattern, string }) => x => string(x).match(pattern(x))),
    $isMatch: named(['pattern', 'string=#'], ({ pattern, string }) => x => new RegExp(pattern(x)).test(string(x))),
    $replace: named(['regex', 'substitute', 'string=#', 'global?'], ({ regex, substitute, string, global }) => x => {
        const p = global?.(x) ? new RegExp(regex(x), 'g') : regex(x);
        return string(x).replace(p, substitute(x));
    }),
    $printf: named(['template', 'args=#'], ({ template, args }) => x => printf(template(x), ...args(x))),
    $round: named(['value=#', 'digits?'], ({ value, digits }) => x => round(value(x), digits?.(x))),
    $min: f => x => min(f(x)),
    $max: f => x => max(f(x)),
    $count: named(['predicate?', 'collection=#', 'as?'], ({ predicate, collection, as }) => x =>
        predicate ? filter(collection(x), lambda(predicate, as, x)).length : collection(x).length),
    $find: named(['predicate', 'collection=#', 'as?'], ({ predicate, collection, as }) => x => find(collection(x), lambda(predicate, as, x))),
    $unique: f => x => uniqWith(f(x), isEqual),
    $pick: named(['keys', 'object=#'], ({ keys, object }) => x => pick(object(x), keys(x))),
    $omit: named(['keys', 'object=#'], ({ keys, object }) => x => omit(object(x), keys(x))),
    $lower: f => x => toStr(f(x)).toLowerCase(),
    $upper: f => x => toStr(f(x)).toUpperCase(),
    $trim: f => x => toStr(f(x)).trim(),
    $isNil: f => x => isNil(f(x)),
    $parseInt: f => x => { const n = parseInt(f(x), 10); return isNaN(n) ? undefined : n; },
    $parseFloat: f => x => { const n = parseFloat(f(x)); return isNaN(n) ? undefined : n; },
}

/**
 * Types of the primitives, so that tools can infer what a program takes and returns.
 * `takes` is the type of the expression argument, or an object of parameter types for
 * named parameters; `returns` the type of the result. Types: `any`, `number`, `string`,
 * `boolean`, `object`, `function` (a lambda), `names` (the `as` parameter), `array` or `array<T>`.
 * A type (JSON Schema) is accepted wherever a notation is. A custom primitive declares its own with
 * `typed(primitive, signature, infer?)`; `infer(argumentTypes, context)` computes the result type from the
 * type of the argument (an object of parameter types for named parameters).
 */
export const typed = (primitive, signature, infer) => {
    const declared = infer ? { ...signature, infer } : signature;
    return typeof primitive === 'function' ? Object.assign(primitive, { signature: declared }) : { ...primitive, signature: declared };
};

const sig = (takes, returns) => ({ takes, returns });
const over = (fn, collection, returns, extra = {}) => sig({ [fn]: 'function', [collection]: collection === 'of' ? 'object' : 'array', ...extra, as: 'names' }, returns);
const numbers = 'array<number>';
const container = { anyOf: [{ type: 'object' }, { type: 'array' }] };

const signatures = {
    $literal: sig('any', 'any'), $: sig('any', 'function'), $in: sig('any', 'any'), $return: sig('any', 'any'),
    $apply: sig({ fn: 'function', to: 'any', as: 'names' }, 'any'),
    $pipeline: sig('array<function>', 'any'),
    $if: sig('array', 'any'), $cond: sig('array', 'any'), $and: sig('array', 'any'), $or: sig('array', 'any'),
    $not: sig('any', 'boolean'), $negate: sig('any', 'boolean'),
    $eq: sig('array', 'boolean'), $neq: sig('array', 'boolean'),
    $lt: sig(numbers, 'boolean'), $lte: sig(numbers, 'boolean'), $gt: sig(numbers, 'boolean'), $gte: sig(numbers, 'boolean'),
    $sum: sig(numbers, 'number'), $subtract: sig(numbers, 'number'), $multiply: sig(numbers, 'number'), $divide: sig(numbers, 'number'),
    $map: over('fn', 'over', 'array'),
    $mapValues: over('fn', 'of', 'object'),
    $filter: over('predicate', 'collection', 'array'),
    $any: over('predicate', 'collection', 'boolean'),
    $all: over('predicate', 'collection', 'boolean'),
    $group: over('by', 'collection', 'object'),
    $toDictionary: over('by', 'collection', 'object'),
    $ascending: over('by', 'collection', 'array'),
    $descending: over('by', 'collection', 'array'),
    $take: sig({ while: 'function', count: 'number', from: 'array', as: 'names' }, 'array'),
    $zip: sig({ with: 'function', sequences: 'array<array>', as: 'names' }, 'array'),
    $fold: sig({ with: 'function', init: 'any', collection: 'array', as: 'names' }, 'any'),
    $head: sig('array', 'any'), $tail: sig('array', 'array'), $concat: sig('array<array>', 'array'),
    $keys: sig(container, 'array<string>'), $values: sig(container, 'array'), $merge: sig('array<object>', 'object'),
    $coalesce: sig('array', 'any'),
    $get: sig({ object: container, path: { anyOf: [{ type: 'string' }, { type: 'number' }] } }, 'any'),
    $includes: sig({ collection: 'array', value: 'any' }, 'boolean'),
    $str: sig('any', 'string'),
    $join: sig({ separator: 'string', strings: 'array' }, 'string'),
    $split: sig({ separator: 'string', string: 'string' }, 'array<string>'),
    $match: sig({ pattern: 'string', string: 'string' }, 'array'),
    $isMatch: sig({ pattern: 'string', string: 'string' }, 'boolean'),
    $replace: sig({ regex: 'string', substitute: 'string', string: 'string', global: 'boolean' }, 'string'),
    $printf: sig({ template: 'string', args: 'array' }, 'string'),
    $round: sig({ value: 'number', digits: 'number' }, 'number'),
    $min: sig(numbers, 'number'), $max: sig(numbers, 'number'),
    $count: over('predicate', 'collection', 'number'),
    $find: over('predicate', 'collection', 'any'),
    $unique: sig('array', 'array'),
    $pick: sig({ keys: 'array<string>', object: 'object' }, 'object'),
    $omit: sig({ keys: 'array<string>', object: 'object' }, 'object'),
    $lower: sig('string', 'string'), $upper: sig('string', 'string'), $trim: sig('string', 'string'),
    $isNil: sig('any', 'boolean'),
    $parseInt: sig('string', 'number'), $parseFloat: sig('string', 'number'),
};

export const primitives = Object.fromEntries(Object.entries(primitiveTable).map(([name, primitive]) =>
    [name, signatures[name] ? typed(primitive, signatures[name]) : primitive]));
