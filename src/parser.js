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
            isFunction(tree) ? parseFunction(primitives, tree) :  parseObject(primitives, tree);
    }

    return () => tree;
}

const varsDeclarationKey = '$let';

function parsePrimitive(primitives, tree) {
    const keys = Object.keys(tree);
    const getLocalVars = parseVars(primitives, tree[varsDeclarationKey]);
    const primitiveKey = find(keys, k => k !== varsDeclarationKey);
    const f = primitives[primitiveKey](parsePrimitiveArgs(primitives, tree[primitiveKey]));
    return ({ vars, input }) => {
        const extendedVars = { ...vars, ...getLocalVars({ vars, input }) };
        return f({ vars: extendedVars, input });
    }
}

function parseFunction(primitives, tree) {
    const keys = Object.keys(tree);
    const getLocalVars = parseVars(primitives, tree[varsDeclarationKey]);
    const functionKey = find(keys, k => k !== varsDeclarationKey);
    const arg = parseTree(primitives, tree[functionKey]); 
    return ({ vars, input }) => {
        const extendedVars = { ...vars, ...getLocalVars({ vars, input }) };
        const f = extendedVars[functionKey];
        return f({ vars: extendedVars, input: arg({ vars: extendedVars, input })});
    }
}

function parsePrimitiveArgs(primitives, tree) {
    if (isString(tree)) { return parseString(tree); }

    if (isArray(tree)) { return parseArray(primitives, tree) }

    if (isObject(tree)) {
        return hasPrimitiveProperties(tree) ? mapValues(tree, n => parseTree(primitives, n)) : parseTree(primitives, tree);
    }

    return () => tree;
}

function isPrimitive(primitives, tree) {
    const ks = Object.keys(tree); 
    return ks.length > 0 && ks.length <= 2 && every(ks, k => !!primitives[k]);
}

function isFunction(tree) {
    const ks = Object.keys(tree); 
    return ks.length > 0 && ks.length <= 2 && every(ks, k => k.startsWith('$')); 
}

function hasPrimitiveProperties(tree) {
    return Object.keys(tree)[0]?.startsWith('_'); 
}

function parseArray(primitives, tree) {
    const funks = map(tree, n => parseTree(primitives, n), primitives);
    return x => map(funks, f => f(x));
}

function parseVars(primitives, obj) {
    const funks = mapValues(obj, n => parseTree(primitives, n));
    return ({vars, input}) => {
        const localVars = {};
        const extendedVars = { ...vars };
        for (const key in funks) {
            localVars[key] = key.startsWith('$')
                ? funks[key]
                : funks[key]({ vars: extendedVars, input });
            extendedVars[key] = localVars[key];
        }
        return localVars;
    }
}

function parseObject(primitives, obj) {
    const funks = mapValues(obj, n => parseTree(primitives, n));
    return x => mapValues(funks, funk => funk(x));
}

function parseString(str) {
    if (str === '#') {
        return ({ input }) => input;
    }
    if (str.startsWith('#')) {
        str = str.slice(1);
        str = /^\d/.test(str) ? `[${str[0]}]` + str.slice(1) : str;
        str = str.startsWith('.') ? str.slice(1) : str; 
        const pointer = str;
        return ({ input }) => get(input, pointer);
    }
    if (str.startsWith('@')) {
        const pointer = str.slice(1);
        return ({ vars }) => get(vars, pointer);
    }
    return () => str;
}
