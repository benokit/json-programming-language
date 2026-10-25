import { printf } from 'fast-printf';
import { concat, divide, eq, every, filter, first, get, groupBy, gt, gte, includes, isArray, join, keyBy, keys, lt, lte, map, mapValues, merge, multiply,
    orderBy, reduce, some, split, subtract, sum, tail, take, takeWhile, values, zipObject, zipWith } from 'lodash-es'

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

const sort = direction => named(['by?', 'collection=#', 'as?'], ({ by, collection, as }) => x =>
    orderBy(collection(x), by ? [v => call(by, as, x, [v])] : undefined, [direction]));

export const primitives = {
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

    $eq: f => x => eq(...f(x)),
    $neq: f => x => !eq(...f(x)),
    $lt: f => x => lt(...f(x)),
    $lte: f => x => lte(...f(x)),
    $gt: f => x => gt(...f(x)),
    $gte: f => x => gte(...f(x)),

    $sum: f => x => sum(f(x)),
    $subtract: f => x => subtract(...f(x)),
    $multiply: f => x => multiply(...f(x)),
    $divide: f => x => divide(...f(x)),

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
    $parseInt: f => x => { const n = parseInt(f(x), 10); return isNaN(n) ? undefined : n; },
    $parseFloat: f => x => { const n = parseFloat(f(x)); return isNaN(n) ? undefined : n; },
}
