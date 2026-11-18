import { get, isArray, isPlainObject, isString, map, mapValues, zipObject } from 'lodash-es'
import { primitives, LambdaJSONRuntimeError } from './primitives.js';

export {
    compile,
    lint,
    signatureOf,
    LambdaJSONError
}
export { primitives, named, special, call, typed, LambdaJSONRuntimeError } from './primitives.js';
export { infer } from './infer.js';

/**
 * A problem in the structure of a program, found while compiling it.
 * `path` is a JSON Pointer to the offending node, `code` a stable identifier.
 */
class LambdaJSONError extends Error {
    constructor(code, path, message) {
        super(`${message} (at ${path || '/'})`);
        this.name = 'LambdaJSONError';
        this.code = code;
        this.path = path;
    }
}

const LET = '$let';
const FN = '$fn';
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/**
 * Converts a program written in pure JSON into a JavaScript function.
 * Throws a LambdaJSONError when the program is malformed.
 * @param {any} program
 * @param {object} extendedPrimitives
 * @returns {function}
 */
function compile(program, extendedPrimitives = {}) {
    const f = compileProgram(program, extendedPrimitives, () => {});
    return input => f({ input, vars: {} });
}

/**
 * Lists the problems of a program without running it: the structural error
 * that makes `compile` throw (if any) and warnings about needless escapes.
 * @param {any} program
 * @param {object} extendedPrimitives
 * @returns {{ severity: 'error' | 'warning', code: string, path: string, message: string }[]}
 */
function lint(program, extendedPrimitives = {}) {
    const problems = [];
    const warn = (code, path, message) => problems.push({ severity: 'warning', code, path, message });
    try {
        compileProgram(program, extendedPrimitives, warn);
    } catch (error) {
        if (!(error instanceof LambdaJSONError)) throw error;
        problems.push({ severity: 'error', code: error.code, path: error.path, message: error.message });
    }
    return problems;
}

/**
 * The declared types of a primitive: `{ takes, returns }`, or undefined when it declares none.
 * @param {string} name
 * @param {object} extendedPrimitives
 */
function signatureOf(name, extendedPrimitives = {}) {
    return ({ ...primitives, ...extendedPrimitives })[name]?.signature;
}

function compileProgram(program, extendedPrimitives, warn) {
    const scope = {
        primitives: { ...primitives, ...extendedPrimitives },
        functions: new Set(),
        warn
    };
    return compileTree(scope, program, '');
}

const pointer = (path, key) => `${path}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;

const fail = (code, path, message) => { throw new LambdaJSONError(code, path, message); };

function compileTree(scope, tree, path) {
    if (isString(tree)) { return compileString(scope, tree, path); }

    if (isArray(tree)) { return compileArray(scope, tree, path); }

    if (isPlainObject(tree)) {
        return Object.keys(tree).some(k => k.startsWith('$'))
            ? compileCall(scope, tree, path)
            : compileObject(scope, tree, path);
    }

    return () => tree;
}

/**
 * Every object with a `$` key is a call: exactly one call key, optionally beside `$let`.
 */
function compileCall(scope, tree, path) {
    const keys = Object.keys(tree);
    const data = keys.filter(k => !k.startsWith('$'));
    if (data.length > 0) {
        const call = keys.find(k => k.startsWith('$'));
        fail('mixed-call', path,
            `'${call}' makes this object a call, so '${data.join("', '")}' can't stand beside it; ` +
            `escape the key as '\\${call}' for a plain object`);
    }

    const calls = keys.filter(k => k !== LET);
    if (calls.length === 0) fail('missing-body', path, `'${LET}' needs a call beside it`);
    if (calls.length > 1) fail('several-calls', path, `one call per object, found '${calls.join("', '")}'`);
    const key = calls[0];

    if (!keys.includes(LET)) {
        return compileHead(scope, key, tree[key], path);
    }

    const declarations = tree[LET];
    const letPath = pointer(path, LET);
    if (!isPlainObject(declarations)) fail('invalid-let', letPath, `'${LET}' is an object of declarations`);
    const inner = { ...scope, functions: new Set(scope.functions) };
    for (const name of Object.keys(declarations)) {
        if (name.startsWith('$')) {
            if (scope.primitives[name] !== undefined) fail('shadowed-primitive', pointer(letPath, name), `'${name}' is a primitive and can't be redeclared`);
            inner.functions.add(name);
        }
    }
    const getLocalVars = compileVars(inner, declarations, letPath);
    const f = compileHead(inner, key, tree[key], path);
    return ({ vars, input }) => {
        const extendedVars = { ...vars, ...getLocalVars({ vars, input }) };
        return f({ vars: extendedVars, input });
    };
}

function compileHead(scope, key, value, path) {
    const argPath = pointer(path, key);
    const primitive = scope.primitives[key];
    if (primitive !== undefined) {
        return compilePrimitive(scope, key, primitive, value, argPath);
    }
    if (scope.functions.has(key)) {
        return compileFunctionCall(scope, key, value, argPath);
    }
    return fail('unknown-function', argPath, `unknown function '${key}': neither a primitive nor declared in an enclosing '${LET}'`);
}

function compilePrimitive(scope, key, primitive, value, path) {
    if (typeof primitive === 'function') {
        return primitive(compileTree(scope, value, path));
    }
    if (primitive.special) {
        return primitive.special(value, specialContext(scope, key, path));
    }
    if (primitive.params) {
        return primitive.impl(compileNamedArgs(scope, key, primitive.params, value, path));
    }
    return fail('invalid-primitive', path, `primitive '${key}' is neither a function nor a { params, impl } or { special } descriptor`);
}

function specialContext(scope, key, path) {
    return {
        compile: (tree, ...steps) => compileTree(scope, tree, steps.reduce(pointer, path)),
        fail: (message, ...steps) => fail('invalid-arguments', steps.reduce(pointer, path), `${key}: ${message}`),
        warn: (code, message, ...steps) => scope.warn(code, steps.reduce(pointer, path), message),
        path
    };
}

/**
 * Parameters are declared as names: `fn` is required, `over=#` defaults to the input,
 * `as?` is optional. The parameter `as` is syntax: the names bound to a lambda's arguments.
 */
function parseParams(params) {
    return params.map(spec => {
        const name = spec.replace(/(=#|\?)$/, '');
        return { name, required: spec === name, defaultsToInput: spec.endsWith('=#') };
    });
}

const inputParam = ({ input }) => input;

function compileNamedArgs(scope, key, params, value, path) {
    const declared = parseParams(params);
    const names = declared.map(p => p.name);
    const expected = `{ ${params.join(', ')} }`;
    if (!isPlainObject(value) || Object.keys(value).some(k => k.startsWith('$'))) {
        fail('named-arguments-expected', path, `'${key}' takes named arguments ${expected}`);
    }

    const args = {};
    for (const [k, v] of Object.entries(value)) {
        const argPath = pointer(path, k);
        if (!names.includes(k)) {
            const hint = k.startsWith('_') && names.includes(k.slice(1)) ? ` (write '${k.slice(1)}': parameters have no '_' prefix since version 2)` : '';
            fail('unknown-parameter', argPath, `'${key}' has no parameter '${k}', expected ${expected}${hint}`);
        }
        args[k] = k === 'as' ? parseAs(v, argPath) : compileTree(scope, v, argPath);
    }
    for (const p of declared) {
        if (p.name in args) continue;
        if (p.required) fail('missing-parameter', path, `'${key}' requires '${p.name}', expected ${expected}`);
        if (p.defaultsToInput) args[p.name] = inputParam;
    }
    return args;
}

function parseAs(value, path) {
    const names = isArray(value) ? value : [value];
    if (names.length === 0 || !names.every(n => isString(n) && IDENTIFIER.test(n))) {
        fail('invalid-as', path, `'as' is a name or an array of names, e.g. "item" or ["total", "item"]`);
    }
    return names;
}

function compileFunctionCall(scope, key, value, path) {
    const arg = compileTree(scope, value, path);
    return ({ vars, input }) => vars[key]({ vars, input: arg({ vars, input }), outer: input });
}

function compileArray(scope, tree, path) {
    const funks = map(tree, (n, i) => compileTree(scope, n, pointer(path, i)));
    return x => map(funks, f => f(x));
}

/**
 * `{ "$fn": { "as": names, "body": expression } }` declares a function with named parameters.
 * The call's argument is bound to the name, or its items to the names of an array; `#` in the
 * body stays the input of the caller.
 */
function compileFunction(scope, tree, path) {
    const fnPath = pointer(path, FN);
    const spec = tree[FN];
    if (!isPlainObject(spec) || Object.keys(spec).some(k => k !== 'as' && k !== 'body') || !('as' in spec) || !('body' in spec)) {
        fail('invalid-function', fnPath, `'${FN}' is an object { as, body }`);
    }
    const names = parseAs(spec.as, pointer(fnPath, 'as'));
    const body = compileTree(scope, spec.body, pointer(fnPath, 'body'));
    return ({ vars, input, outer }) => {
        const args = isArray(spec.as) ? input : [input];
        if (args.length !== names.length) {
            throw new LambdaJSONRuntimeError('wrong-argument-count', fnPath, `the function takes ${names.length} argument(s), got ${args.length}`);
        }
        return body({ vars: { ...vars, ...zipObject(names, args) }, input: outer });
    };
}

const isFunctionDeclaration = tree => isPlainObject(tree) && Object.keys(tree).length === 1 && FN in tree;

function compileVars(scope, obj, path) {
    const funks = mapValues(obj, (n, k) => k.startsWith('$') && isFunctionDeclaration(n)
        ? compileFunction(scope, n, pointer(path, k))
        : compileTree(scope, n, pointer(path, k)));
    return ({ vars, input }) => {
        const localVars = {};
        const extendedVars = { ...vars };
        for (const key in funks) {
            localVars[key] = key.startsWith('$')
                ? funks[key]
                : funks[key]({ vars: extendedVars, input });
            extendedVars[key] = localVars[key];
        }
        return localVars;
    };
}

function compileObject(scope, obj, path) {
    const funks = {};
    for (const key of Object.keys(obj)) {
        let outKey = key;
        if (key.startsWith('\\')) {
            outKey = key.slice(1);
            if (!outKey.startsWith('$') && !outKey.startsWith('\\')) {
                scope.warn('needless-escape', pointer(path, key), `the key '${outKey}' needs no escape`);
            }
        }
        funks[outKey] = compileTree(scope, obj[key], pointer(path, key));
    }
    return x => mapValues(funks, f => f(x));
}

function compileString(scope, str, path) {
    if (str.startsWith('\\')) {
        const value = str.slice(1);
        if (!/^[#@\\]/.test(value)) {
            scope.warn('needless-escape', path, `the string '${value}' needs no escape`);
        }
        return () => value;
    }
    if (str === '#') {
        return ({ input }) => input;
    }
    if (str.startsWith('#')) {
        let p = str.slice(1);
        p = /^\d/.test(p) ? `[${p[0]}]` + p.slice(1) : p;
        p = p.startsWith('.') ? p.slice(1) : p;
        return ({ input }) => get(input, p);
    }
    if (str.startsWith('@')) {
        const p = str.slice(1);
        return ({ vars }) => get(vars, p);
    }
    return () => str;
}
