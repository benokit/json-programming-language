import { isObject, isString, map, get, find, mapValues, isArray, sum } from "lodash-es"

export {
    parseFunction as parse
}

function parseFunction(tree) {
    if (isString(tree)) {
        return parseString(tree);
    }

    if (isArray(tree)) {
       return parseArray(tree) 
    }

    if (isObject(tree)) {
        if (hasPrimitiveRoot(tree)) {
            return parsePrimitive(tree);
        }
        return parseObject(tree);
    }

    return () => tree;
}

function hasPrimitiveRoot(node) {
    const branches = Object.keys(node);
    return branches.length <=2 && !!primitives[branches[0]];
}

function parsePrimitive(tree) {
    const branches = Object.keys(tree);
    const getLocals = parseObject(tree['$let']);
    const primitiveKey = find(branches, b => b !== '$let');
    const f = primitives[primitiveKey](tree[primitiveKey])
    return ({ global, input, local }) => {
        const extendedGlobal = { ...global, ...getLocals({ global, input, local }) };
        return f({ global: extendedGlobal, input, local });
    }
}

function parseArray(tree) {
    const funks = map(tree, parseFunction);
    return x => {
        return map(funks, f => f(x));
    }
}

function parseObject(obj) {
    const funks = mapValues(obj, parseFunction);
    return ({global, input, local}) => {
        const result = {};
        const extendedGlobal = { ...global };
        for (const key in funks) {
            result[key] = key.startsWith('$')
                ? funks[key]
                : funks[key]({ global: extendedGlobal, input, local });
            extendedGlobal[key] = result[key];
        }
        return result;
    }
}

function parseString(tree) {
    if (tree === '#') {
        return ({ local }) => local;
    }
    if (tree.startsWith('#.')) {
        const pointer = tree.slice(2);
        return ({ local }) => get(local, pointer);
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
            return x => x.global[pointer](x);
        }
        return ({ global }) => get(global, pointer);
    }
    return () => tree;
}

const primitives = {
    $let: true,
    $return: (lhs) => {
        const f = parseFunction(lhs);
        return x => f(x);
    },
    $apply: ({ $fn, $to }) => {
        const f = parseFunction($fn);
        const to = parseFunction($to);
        return (x) => f({ ...x, local: to(x)});
    },
    $map: ({ $fn, $over }) => {
        const f = parseFunction($fn);
        const over = parseFunction($over);
        return (x) => map(over(x), v => f({ ...x, local: v }));
    },
    $sum: (lhs) => {
        const fs = parseFunction(lhs);
        return x => sum(fs(x));
    }
}