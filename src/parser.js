import { isObject, isString, map, get, find, mapValues, isArray } from 'lodash-es'
import { primitives } from './primitives.js';

export {
    parse
}

function parse(program) {
    const f = parseTree(program);
    return input => f({input});
}

function parseTree(tree) {
    if (isString(tree)) {
        return parseString(tree);
    }

    if (isArray(tree)) {
       return parseArray(tree) 
    }

    if (isObject(tree)) {
        if (isPrimitive(tree)) {
            return parsePrimitive(tree);
        }
        return parseObject(tree);
    }

    return () => tree;
}

function isPrimitive(tree) {
    const params = Object.keys(tree);
    return params.length <=2 && !!primitives[params[0]];
}

function parsePrimitive(tree) {
    const params = Object.keys(tree);
    const getLocals = parseObject(tree['$let']);
    const keyOfPrimitive = find(params, b => b !== '$let');
    const f = primitives[keyOfPrimitive](parsePrimitiveArgs(tree[keyOfPrimitive]));
    return ({ vars, input, value }) => {
        const extendedVars = { ...vars, ...getLocals({ vars, input, value }) };
        return f({ vars: extendedVars, input, value });
    }
}

function parsePrimitiveArgs(tree) {
    if (isString(tree)) {
        return parseString(tree);
    }

    if (isArray(tree)) {
       return parseArray(tree) 
    }

    if (isObject(tree)) {
        if (Object.keys(tree)[0]?.startsWith('$')) {
            return mapValues(tree, parseTree);
        }
        return parseObject(tree);
    }

    return () => tree;
}

function parseArray(tree) {
    const funks = map(tree, parseTree);
    return x => {
        return map(funks, f => f(x));
    }
}

function parseObject(obj) {
    const funks = mapValues(obj, parseTree);
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
