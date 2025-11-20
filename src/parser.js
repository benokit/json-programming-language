import { isObject, isString, map, get, find, mapValues, isArray } from 'lodash-es'
import { primitives } from './primitives.js';

export {
    parse
}

function parse(program, extendedPrimitives = {}) {
    const f = parseTree({ ...primitives, ...extendedPrimitives }, program);
    return input => f({input});
}

function parseTree(primitives, tree) {
    if (isString(tree)) { return parseString(tree); }

    if (isArray(tree)) { return parseArray(primitives, tree) }

    if (isObject(tree)) {
        return hasPrimitiveProperties(tree) ? parsePrimitive(primitives, tree) : parseObject(primitives, tree);
    }

    return () => tree;
}

function parsePrimitive(primitives, tree) {
    const params = Object.keys(tree);
    const getLocalVars = parseVars(primitives, tree['$let']);
    const keyOfPrimitive = find(params, b => b !== '$let');
    const f = primitives[keyOfPrimitive](parsePrimitiveArgs(primitives, tree[keyOfPrimitive]));
    return ({ vars, input, value }) => {
        const extendedVars = { ...vars, ...getLocalVars({ vars, input, value }) };
        return f({ vars: extendedVars, input, value });
    }
}

function parsePrimitiveArgs(primitives, tree) {
    if (isString(tree)) { return parseString(tree); }

    if (isArray(tree)) { return parseArray(primitives, tree) }

    if (isObject(tree)) {
        return hasPrimitiveProperties(tree) ? mapValues(tree, n => parseTree(primitives, n)) : parseObject(primitives, tree);
    }

    return () => tree;
}

function hasPrimitiveProperties(tree) {
    return Object.keys(tree)[0]?.startsWith('$'); 
}

function parseArray(primitives, tree) {
    const funks = map(tree, n => parseTree(primitives, n), primitives);
    return x => {
        return map(funks, f => f(x));
    }
}

function parseVars(primitives, obj) {
    const funks = mapValues(obj, n => parseTree(primitives, n));
    return ({vars, input, value}) => {
        const result = {};
        const extendedVars = { ...vars };
        for (const key in funks) {
            result[key] = key.startsWith('$')
                ? funks[key]
                : funks[key]({ vars: extendedVars, input, value });
            extendedVars[key] = result[key];
        }
        return result;
    }
}

function parseObject(primitives, obj) {
    const funks = mapValues(obj, n => parseTree(primitives, n));
    return x => mapValues(funks, funk => funk(x));
}

function parseString(tree) {
    if (tree === '#') {
        return ({ value }) => value;
    }
    if (tree.startsWith('#.')) {
        const pointer = tree.slice(2);
        return ({ value }) => get(value, pointer);
    }
    if (tree === '$') {
        return ({ input }) => input;
    }
    if (tree.startsWith('$.')) {
        const pointer = tree.slice(2);
        return ({ input }) => get(input, pointer);
    }
    if (tree.startsWith('@')) {
        const pointer = tree.slice(1);
        if (pointer.startsWith('$')) {
            return x => x.vars[pointer](x);
        }
        return ({ vars }) => get(vars, pointer);
    }
    return () => tree;
}
