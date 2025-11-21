import { isObject, isString, map, get, find, mapValues, isArray, every } from 'lodash-es'
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
        return isPrimitive(primitives, tree) ? parsePrimitive(primitives, tree) : 
            has$Properties(tree) ? parseFunction(primitives, tree) :  parseObject(primitives, tree);
    }

    return () => tree;
}

function parsePrimitive(primitives, tree) {
    const params = Object.keys(tree);
    const getLocalVars = parseVars(primitives, tree['$let']);
    const keyOfPrimitive = find(params, b => b !== '$let');
    const f = primitives[keyOfPrimitive](parsePrimitiveArgs(primitives, tree[keyOfPrimitive]));
    return ({ vars, input }) => {
        const extendedVars = { ...vars, ...getLocalVars({ vars, input }) };
        return f({ vars: extendedVars, input });
    }
}

function parseFunction(primitives, tree) {
    const params = Object.keys(tree);
    const getLocalVars = parseVars(primitives, tree['$let']);
    const keyOfFunction = find(params, b => b !== '$let');
    const arg = parseTree(primitives, tree[keyOfFunction]); 
    return ({ vars, input }) => {
        const extendedVars = { ...vars, ...getLocalVars({ vars, input }) };
        const f = extendedVars[keyOfFunction];
        return f({ vars: extendedVars, input: arg({ vars: extendedVars, input })});
    }
}

function parsePrimitiveArgs(primitives, tree) {
    if (isString(tree)) { return parseString(tree); }

    if (isArray(tree)) { return parseArray(primitives, tree) }

    if (isObject(tree)) {
        return has$Properties(tree) ? mapValues(tree, n => parseTree(primitives, n)) : parseObject(primitives, tree);
    }

    return () => tree;
}

function isPrimitive(primitives, tree) {
    const ks = Object.keys(tree); 
    return ks.length > 0 && every(ks, k => !!primitives[k]);
}

function has$Properties(tree) {
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
    return ({vars, input}) => {
        const result = {};
        const extendedVars = { ...vars };
        for (const key in funks) {
            result[key] = key.startsWith('$')
                ? funks[key]
                : funks[key]({ vars: extendedVars, input });
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
        return ({ input }) => input;
    }
    if (tree.startsWith('#.')) {
        const pointer = tree.slice(2);
        return ({ input }) => get(input, pointer);
    }
    if (tree.startsWith('@')) {
        const pointer = tree.slice(1);
        return ({ vars }) => get(vars, pointer);
    }
    return () => tree;
}
