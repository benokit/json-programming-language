import { isObject, isString, map, get, find, mapValues, isArray, sum } from "lodash-es"

export {
    parseFunction as parse
}

function parseFunction(tree) {
    if (isString(tree)) {
        if (tree == '#') {
            return ({ local }) => local;
        }
        if (tree.startsWith('#.')) {
            const pointer = tree.slice(2);
            return ({ local }) => get(local, pointer);
        }
        if (tree == '$') {
            return ({ input }) => input;
        }
        if (tree.startsWith('$.')) {
            const pointer = tree.slice(2);
            return ({ input }) => get(input, pointer);
        }
        if (tree.startsWith('@')) {
            const pointer = tree.slice(1);
            return ({ global }) => get(global, pointer);
        }
        return () => tree; 
    }

    if (isObject(tree)) {
        const branches = Object.keys(tree);
        if (branches.length <= 2 && primitives[branches[0]]) {
            const getLocals = parseObject(tree['$let']);
            const primitiveKey = find(branches, b => b !== '$let');
            const f = primitives[primitiveKey](tree[primitiveKey])
            return ({ global, input, local }) => {
                const extendedGlobal = { ...global, ...getLocals({ global, input, local }) };
                return f({ global: extendedGlobal, input });
            }
        }
        return parseObject(tree);
    }

    if (isArray(tree)) {
        const funks = map(tree, parseFunction);
        return x => {
            return map(funks, f => f(x));
        }
    }

    return () => tree;
}

function parseObject(obj) {
    const funks = mapValues(obj, parseFunction);
    return ({global, input, local}) => {
        const result = {};
        const extendedGlobal = { ...global };
        for (const key in funks) {
            result[key] = funks[key]({ global: extendedGlobal, input, local });
            extendedGlobal[key] = result[key];
        }
        return result;
    }
}

const primitives = {
    $return: (lhs) => {
        const f = parseFunction(lhs);
        return x => f(x);
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