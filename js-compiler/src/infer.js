import { isArray, isEqual, isPlainObject, isString, mapValues, toPath } from 'lodash-es';
import { primitives as builtins } from './primitives.js';
import { lint } from './js-compiler.js';
import {
    ANY, ARRAY, BOOLEAN, FUNCTION, NULL, NUMBER, OBJECT, STRING,
    arrayOf, describe, disjoint, isAny, isNullable, itemOf, literalType, members, nonNull, normalize,
    nullable, objectOf, orAny, toType, tuple, union, valueOf, walkPath
} from './types.js';

const LET = '$let';
const pointer = (path, ...keys) => keys.reduce((p, key) => `${p}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`, path);
const NUMBER_OR_STRING = union(NUMBER, STRING);
const isTuple = t => t.type === 'array' && t.items === false && t.prefixItems !== undefined;

/**
 * Infers the type of the result of a program from the type of its input, and reports the
 * problems that are certain (errors) or possible (warnings) before it runs.
 * @param {any} program
 * @param {{ input?: object, vars?: object, primitives?: object }} options types as JSON Schema
 * @returns {{ type: object, problems: { severity: 'error' | 'warning', code: string, path: string, message: string }[] }}
 */
export function infer(program, { input = {}, vars = {}, primitives: extended = {} } = {}) {
    const problems = lint(program, extended);
    if (problems.some(p => p.severity === 'error')) return { type: ANY, problems };
    const seen = new Set(problems.map(p => JSON.stringify(p)));
    const report = (severity, code, path, message) => {
        const problem = { severity, code, path, message };
        const key = JSON.stringify(problem);
        if (!seen.has(key)) {
            seen.add(key);
            problems.push(problem);
        }
    };
    const engine = createEngine({ ...builtins, ...extended }, report);
    const env = { input: toType(input), vars: mapValues(vars, toType), funcs: new Map() };
    return { type: engine.tree(env, program, ''), problems };
}

function createEngine(prims, report) {
    const active = new Set();

    const error = (code, path, message) => report('error', code, path, message);
    const warning = (code, path, message) => report('warning', code, path, message);

    function tree(env, node, path) {
        if (isString(node)) return string(env, node, path);
        if (isArray(node)) return tuple(node.map((n, i) => tree(env, n, pointer(path, i))));
        if (isPlainObject(node)) {
            return Object.keys(node).some(k => k.startsWith('$')) ? call(env, node, path) : object(env, node, path);
        }
        return literalType(node);
    }

    function object(env, node, path) {
        const properties = {};
        for (const key of Object.keys(node)) {
            properties[key.startsWith('\\') ? key.slice(1) : key] = tree(env, node[key], pointer(path, key));
        }
        return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
    }

    function string(env, node, path) {
        if (node.startsWith('\\')) return literalType(node.slice(1));
        if (node === '#') return env.input;
        const fail = message => error('unknown-path', path, message);
        if (node.startsWith('#')) {
            let p = node.slice(1);
            p = /^\d/.test(p) ? `[${p[0]}]` + p.slice(1) : p;
            p = p.startsWith('.') ? p.slice(1) : p;
            return walkPath(env.input, toPath(p), fail);
        }
        if (node.startsWith('@')) {
            const [name, ...rest] = toPath(node.slice(1));
            if (name === undefined || !Object.prototype.hasOwnProperty.call(env.vars, name)) {
                error('unknown-variable', path, `'${name ?? ''}' is not bound by an enclosing '${LET}' or 'as'`);
                return ANY;
            }
            return walkPath(env.vars[name], rest, fail);
        }
        return literalType(node);
    }

    function call(env, node, path) {
        const keys = Object.keys(node);
        const key = keys.find(k => k !== LET);
        if (!keys.includes(LET)) return head(env, key, node[key], path);

        const letPath = pointer(path, LET);
        const declarations = node[LET];
        const funcs = new Map(env.funcs);
        const inner = { ...env, funcs, vars: { ...env.vars } };
        for (const name of Object.keys(declarations)) {
            if (name.startsWith('$')) funcs.set(name, { tree: declarations[name], path: pointer(letPath, name), funcs });
        }
        for (const name of Object.keys(declarations)) {
            if (!name.startsWith('$')) inner.vars[name] = tree(inner, declarations[name], pointer(letPath, name));
        }
        return head(inner, key, node[key], path);
    }

    function head(env, key, value, path) {
        const argPath = pointer(path, key);
        const prim = prims[key];
        return prim !== undefined ? primitive(env, key, prim, value, argPath) : functionCall(env, key, value, argPath);
    }

    function functionCall(env, key, value, path) {
        const arg = tree(env, value, path);
        const decl = env.funcs.get(key);
        if (!decl || active.has(decl)) return ANY;
        active.add(decl);
        try {
            const fn = isPlainObject(decl.tree) && Object.keys(decl.tree).length === 1 ? decl.tree.$fn : undefined;
            if (fn === undefined) return tree({ input: arg, vars: env.vars, funcs: decl.funcs }, decl.tree, decl.path);
            const vars = { ...env.vars, ...bindParameters(fn.as, arg, path) };
            return tree({ input: env.input, vars, funcs: decl.funcs }, fn.body, pointer(decl.path, '$fn', 'body'));
        } finally {
            active.delete(decl);
        }
    }

    function bindParameters(as, arg, path) {
        if (!isArray(as)) return { [as]: arg };
        if (disjoint(arg, ARRAY)) {
            error('type-mismatch', path, `the function takes ${as.length} arguments as an array, got ${describe(arg)}`);
            return Object.fromEntries(as.map(name => [name, ANY]));
        }
        const argument = nonNull(arg);
        if (isTuple(argument)) {
            if (argument.prefixItems.length !== as.length) {
                error('wrong-argument-count', path, `the function takes ${as.length} arguments, got ${argument.prefixItems.length}`);
                return Object.fromEntries(as.map(name => [name, ANY]));
            }
            return Object.fromEntries(as.map((name, i) => [name, argument.prefixItems[i]]));
        }
        const item = itemOf(argument);
        return Object.fromEntries(as.map(name => [name, item]));
    }

    function primitive(env, key, prim, value, path) {
        const builtin = prim === builtins[key];
        if (builtin && FORMS[key]) return FORMS[key](env, value, path);
        if (prim.params) return named(env, key, prim, value, path, builtin);
        if (typeof prim !== 'function') return returnsOf(prim.signature, ANY);
        return positional(env, key, prim, value, path, builtin);
    }

    const returnsOf = (signature, argument) => {
        if (signature === undefined) return ANY;
        if (signature.infer) return normalize(signature.infer(argument, {}));
        return signature.returns === undefined ? ANY : toType(signature.returns);
    };

    function positional(env, key, prim, value, path, builtin) {
        const arg = tree(env, value, path);
        const signature = prim.signature;
        if (signature?.takes !== undefined) checkTakes(toType(signature.takes), arg, value, path);
        if (builtin && RESULTS[key]) return RESULTS[key](arg, path);
        return returnsOf(signature, arg);
    }

    /** The operands of an argument that is an array: [{ type, path }]. */
    function operands(value, arg, path) {
        const array = nonNull(arg);
        if (array.prefixItems) {
            const list = array.prefixItems.map((type, i) => ({ type, path: isArray(value) ? pointer(path, i) : path }));
            return array.items === false ? list : [...list, { type: array.items ?? ANY, path }];
        }
        return [{ type: itemOf(array), path }];
    }

    function check(expected, actual, path, what) {
        if (disjoint(actual, expected)) {
            error('type-mismatch', path, `${what} is ${describe(actual)}, expected ${describe(expected)}`);
        }
    }

    function checkTakes(expected, arg, value, path) {
        if (expected.type === 'array' && expected.items && expected.items !== false) {
            check(ARRAY, arg, path, 'the argument');
            if (disjoint(arg, ARRAY)) return;
            for (const operand of operands(value, arg, path)) check(expected.items, operand.type, operand.path, 'an item');
        } else {
            check(expected, arg, path, 'the argument');
        }
    }

    function named(env, key, prim, value, path, builtin) {
        const signature = prim.signature;
        const takes = isPlainObject(signature?.takes) ? signature.takes : {};
        const rule = builtin ? NAMED[key] : undefined;
        const types = {};
        const lambdas = {};
        for (const [k, v] of Object.entries(value)) {
            const argPath = pointer(path, k);
            if (k === 'as') continue;
            if (takes[k] === 'function') {
                lambdas[k] = [v, argPath];
                continue;
            }
            types[k] = tree(env, v, argPath);
            if (takes[k] !== undefined) check(toType(takes[k]), types[k], argPath, `'${k}'`);
        }
        for (const spec of prim.params) {
            const name = spec.replace(/(=#|\?)$/, '');
            if (spec.endsWith('=#') && !(name in types) && !(name in lambdas)) {
                types[name] = env.input;
                if (takes[name] !== undefined) check(toType(takes[name]), env.input, path, `the input`);
            }
        }
        const as = value.as === undefined ? undefined : isArray(value.as) ? value.as : [value.as];
        const bodies = {};
        for (const k of Object.keys(lambdas)) {
            const run = (args, input) => lambda(env, lambdas[k], as, args, input);
            bodies[k] = rule?.fns?.[k] ? rule.fns[k](types, run) : run([], ANY);
        }
        if (rule?.result) return rule.result(types, bodies, path);
        return returnsOf(signature, types);
    }

    function lambda(env, [node, path], as, args, input = args[0] ?? ANY) {
        const scope = as === undefined
            ? { ...env, input }
            : { ...env, vars: { ...env.vars, ...Object.fromEntries(as.map((name, i) => [name, args[i] ?? ANY])) } };
        return tree(scope, node, path);
    }

    /** Arithmetic and ordering fail at run time on a missing operand. */
    const strict = accepted => (env, value, path) => {
        const arg = tree(env, value, path);
        if (disjoint(arg, ARRAY)) {
            error('type-mismatch', path, `the argument is ${describe(arg)}, expected an array of operands`);
        } else {
            if (isNullable(arg)) warning('possibly-missing-operand', path, 'the operands may be missing');
            for (const operand of operands(value, arg, path)) {
                if (disjoint(operand.type, accepted)) {
                    error('type-mismatch', operand.path, `an operand is ${describe(operand.type)}, expected ${describe(accepted)}`);
                } else if (isNullable(operand.type)) {
                    warning('possibly-missing-operand', operand.path, `an operand may be missing: ${describe(operand.type)}`);
                }
            }
        }
    };
    const arithmetic = strict(NUMBER);
    const ordering = strict(NUMBER_OR_STRING);

    const truthyConst = t => 'const' in t && !!t.const;
    const args = (env, value, path) => value.map((v, i) => tree(env, v, pointer(path, i)));

    const FORMS = {
        $literal: (env, value) => literalType(value),
        $: (env, value, path) => {
            tree({ ...env, input: ANY }, value, path);
            return FUNCTION;
        },
        $if: (env, value, path) => {
            const [, then, otherwise] = args(env, value, path);
            return otherwise ? union(then, otherwise) : nullable(then);
        },
        $cond: (env, value, path) => {
            const results = value.map((clause, i) => [tree(env, clause[0], pointer(path, i, 0)), tree(env, clause[1], pointer(path, i, 1))]);
            const last = results[results.length - 1];
            const total = last && !isAny(last[0]) && members(last[0]).every(truthyConst);
            return orAny(union(...results.map(r => r[1]), ...(total ? [] : [NULL])));
        },
        $and: (env, value, path) => logic(env, value, path, true),
        $or: (env, value, path) => logic(env, value, path, false),
    };
    for (const key of ['$sum', '$subtract', '$multiply', '$divide']) {
        FORMS[key] = (env, value, path) => { arithmetic(env, value, path); return NUMBER; };
    }
    for (const key of ['$lt', '$lte', '$gt', '$gte']) {
        FORMS[key] = (env, value, path) => { ordering(env, value, path); return BOOLEAN; };
    }

    function logic(env, value, path, empty) {
        const types = isArray(value) ? args(env, value, path) : [itemOf(tree(env, value, path))];
        return orAny(union(...types, ...(types.length === 0 ? [literalType(empty)] : [])));
    }

    const mergeObjects = types => {
        const objects = types.map(nonNull);
        if (!objects.every(t => t.type === 'object')) return OBJECT;
        const properties = {};
        const required = new Set();
        let closed = true;
        for (const t of objects) {
            for (const [k, p] of Object.entries(t.properties ?? {})) {
                const previous = properties[k];
                properties[k] = previous && nonNull(previous).type === 'object' && nonNull(p).type === 'object' ? mergeObjects([previous, p]) : p;
            }
            (t.required ?? []).forEach(k => required.add(k));
            closed = closed && t.additionalProperties === false;
        }
        return { type: 'object', properties, required: [...required], ...(closed ? { additionalProperties: false } : {}) };
    };

    const literalKeys = t => {
        const list = nonNull(t);
        return isTuple(list) && list.prefixItems.every(m => typeof m.const === 'string') ? list.prefixItems.map(m => m.const) : null;
    };

    const restrict = (object, keep) => {
        const o = nonNull(object);
        if (o.type !== 'object') return OBJECT;
        const result = { ...o };
        if (o.properties) result.properties = Object.fromEntries(Object.entries(o.properties).filter(([k]) => keep(k)));
        if (o.required) result.required = o.required.filter(keep);
        return result;
    };

    const RESULTS = {
        $in: a => a,
        $return: a => a,
        $eq: (a, path) => compared(a, path),
        $neq: (a, path) => compared(a, path),
        $head: a => {
            const list = nonNull(a);
            if (list.prefixItems?.length > 0) return list.prefixItems[0];
            return isTuple(list) ? NULL : nullable(itemOf(list));
        },
        $tail: a => arrayOf(itemOf(a)),
        $unique: a => arrayOf(itemOf(a)),
        $concat: a => arrayOf(orAny(union(...operands(undefined, a, '').map(o => itemOf(o.type))))),
        $keys: a => {
            const o = nonNull(a);
            const keys = o.type === 'object' && o.additionalProperties === false ? Object.keys(o.properties ?? {}) : null;
            return arrayOf(keys && keys.length > 0 ? { type: 'string', enum: keys } : STRING);
        },
        $values: a => arrayOf(valueOf(a)),
        $merge: a => mergeObjects(operands(undefined, a, '').map(o => o.type)),
        $coalesce: a => {
            const list = nonNull(a);
            if (!isTuple(list)) return nullable(itemOf(list));
            const result = [];
            for (const type of list.prefixItems) {
                result.push(nonNull(type));
                if (!isNullable(type)) return orAny(union(...result));
            }
            return orAny(union(...result, NULL));
        },
        $match: () => nullable(arrayOf(STRING)),
        $parseInt: () => nullable(NUMBER),
        $parseFloat: () => nullable(NUMBER),
    };

    function compared(a, path) {
        const list = nonNull(a);
        if (list.prefixItems?.length >= 2 && disjoint(list.prefixItems[0], list.prefixItems[1])) {
            warning('impossible-comparison', path, `${describe(list.prefixItems[0])} and ${describe(list.prefixItems[1])} are never equal`);
        }
        return BOOLEAN;
    }

    const over = (collection, fn, result, argsOf = item => [item, NUMBER]) => ({
        fns: { [fn]: (t, run) => run(argsOf(itemOf(t[collection]))) },
        result: (t, b) => result(b, itemOf(t[collection])),
    });
    const sequenceItems = sequences => {
        const list = nonNull(sequences);
        return isTuple(list) && list.prefixItems.length === 2
            ? list.prefixItems.map(itemOf)
            : [itemOf(itemOf(list)), itemOf(itemOf(list))];
    };

    const NAMED = {
        $map: over('over', 'fn', b => arrayOf(b.fn)),
        $filter: over('collection', 'predicate', (b, item) => arrayOf(item)),
        $any: over('collection', 'predicate', () => BOOLEAN),
        $all: over('collection', 'predicate', () => BOOLEAN),
        $find: over('collection', 'predicate', (b, item) => nullable(item)),
        $count: over('collection', 'predicate', () => NUMBER),
        $group: over('collection', 'by', (b, item) => objectOf(arrayOf(item)), item => [item]),
        $toDictionary: over('collection', 'by', (b, item) => objectOf(item), item => [item]),
        $ascending: over('collection', 'by', (b, item) => arrayOf(item), item => [item]),
        $descending: over('collection', 'by', (b, item) => arrayOf(item), item => [item]),
        $take: over('from', 'while', (b, item) => arrayOf(item), item => [item]),
        $mapValues: {
            fns: { fn: (t, run) => run([valueOf(t.of), STRING]) },
            result: (t, b) => objectOf(b.fn),
        },
        $apply: {
            fns: { fn: (t, run) => run([t.to]) },
            result: (t, b) => b.fn,
        },
        $zip: {
            fns: { with: (t, run) => { const pair = sequenceItems(t.sequences); return run(pair, tuple(pair)); } },
            result: (t, b) => arrayOf('with' in b ? b.with : tuple(sequenceItems(t.sequences))),
        },
        $fold: {
            fns: {
                with: (t, run) => {
                    const item = itemOf(t.collection);
                    let accumulator = t.init ?? item;
                    for (let pass = 0; pass < 2; pass++) {
                        const next = union(accumulator, run([accumulator, item], tuple([accumulator, item])));
                        if (isEqual(next, accumulator)) break;
                        accumulator = next;
                    }
                    return accumulator;
                }
            },
            result: (t, b) => b.with,
        },
        $get: {
            result: (t, b, path) => {
                const literal = t.path && 'const' in t.path && typeof t.path.const === 'string';
                return literal ? walkPath(t.object, toPath(t.path.const), message => error('unknown-path', pointer(path, 'path'), message)) : ANY;
            },
        },
        $pick: {
            result: t => { const keys = literalKeys(t.keys); return keys ? restrict(t.object, k => keys.includes(k)) : OBJECT; },
        },
        $omit: {
            result: t => { const keys = literalKeys(t.keys); return keys ? restrict(t.object, k => !keys.includes(k)) : nonNull(t.object).type === 'object' ? nonNull(t.object) : OBJECT; },
        },
    };

    return { tree };
}
