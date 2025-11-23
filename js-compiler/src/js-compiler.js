import { isObject, isString, map, get, find, mapValues, isArray, every } from 'lodash-es'
import { primitives } from './primitives.js';

export {
    compile
}

/**
 * Converts program written in pure json  
 * @param {object} program 
 * @param {object} extendedPrimitives 
 * @returns {function}
 */
function compile(program, extendedPrimitives = {}) {
    const f = compileTree({ ...primitives, ...extendedPrimitives }, program);
    return input => f({input});
}

function compileTree(primitives, tree) {
    if (isString(tree)) { return compileString(tree); }

    if (isArray(tree)) { return compileArray(primitives, tree) }

    if (isObject(tree)) {
        return isPrimitive(primitives, tree) ? compilePrimitive(primitives, tree) : 
            isFunction(tree) ? compileFunction(primitives, tree) :  compileObject(primitives, tree);
    }

    return () => tree;
}

const varsDeclarationKey = '$let';

function compilePrimitive(primitives, tree) {
    const keys = Object.keys(tree);
    const getLocalVars = compileVars(primitives, tree[varsDeclarationKey]);
    const primitiveKey = find(keys, k => k !== varsDeclarationKey);
    const f = primitives[primitiveKey](parsePrimitiveArgs(primitives, tree[primitiveKey]));
    return ({ vars, input }) => {
        const extendedVars = { ...vars, ...getLocalVars({ vars, input }) };
        return f({ vars: extendedVars, input });
    }
}

function compileFunction(primitives, tree) {
    const keys = Object.keys(tree);
    const getLocalVars = compileVars(primitives, tree[varsDeclarationKey]);
    const functionKey = find(keys, k => k !== varsDeclarationKey);
    const arg = compileTree(primitives, tree[functionKey]); 
    return ({ vars, input }) => {
        const extendedVars = { ...vars, ...getLocalVars({ vars, input }) };
        const f = extendedVars[functionKey];
        return f({ vars: extendedVars, input: arg({ vars: extendedVars, input })});
    }
}

function parsePrimitiveArgs(primitives, tree) {
    if (isString(tree)) { return compileString(tree); }

    if (isArray(tree)) { return compileArray(primitives, tree) }

    if (isObject(tree)) {
        return hasPrimitiveProperties(tree) ? mapValues(tree, n => compileTree(primitives, n)) : compileTree(primitives, tree);
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

function compileArray(primitives, tree) {
    const funks = map(tree, n => compileTree(primitives, n), primitives);
    return x => map(funks, f => f(x));
}

function compileVars(primitives, obj) {
    const funks = mapValues(obj, n => compileTree(primitives, n));
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

function compileObject(primitives, obj) {
    const funks = mapValues(obj, n => compileTree(primitives, n));
    return x => mapValues(funks, funk => funk(x));
}

function compileString(str) {
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
