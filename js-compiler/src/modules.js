import { isArray, isPlainObject, isString } from 'lodash-es';
import { primitives as builtins } from './primitives.js';
import { LambdaJSONError } from './errors.js';

/**
 * Modules: named objects of functions (`{ $name: primitive }`), injected into `compile` and `infer`.
 * The rules about names live here, shared by the compiler and `infer`.
 */

export const MODULE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const pointer = (path, key) => `${path}/${String(key).replace(/~/g, '~0').replace(/\//g, '~1')}`;

/** A member name: starts with `$`, has no `/`, and is not a primitive of the language. */
export function checkMemberName(name, path, where) {
    if (!name.startsWith('$') || name.includes('/') || name.length < 2) {
        throw new LambdaJSONError('invalid-module', path, `${where}: '${name}' is not a function name (it starts with '$' and has no '/')`);
    }
    if (builtins[name] !== undefined) {
        throw new LambdaJSONError('reserved-function', path, `${where}: '${name}' is a primitive of the language and can't be redefined`);
    }
}

/** Checks the injected modules: names, shape and members. */
export function checkModules(modules) {
    if (!isPlainObject(modules)) throw new LambdaJSONError('invalid-module', '', `'modules' is an object of modules`);
    for (const [name, module] of Object.entries(modules)) {
        if (!MODULE_NAME.test(name)) {
            throw new LambdaJSONError('invalid-module-name', '', `'${name}' is not a module name (lowercase words or digits, joined by '-')`);
        }
        if (!isPlainObject(module)) throw new LambdaJSONError('invalid-module', '', `module '${name}' is an object of functions`);
        for (const member of Object.keys(module)) checkMemberName(member, '', `module '${name}'`);
    }
}

/** The members of every module under their qualified name: `$mod/name`. */
export function qualifiedMembers(modules) {
    checkModules(modules);
    const table = {};
    for (const [name, module] of Object.entries(modules)) {
        for (const [member, primitive] of Object.entries(module)) table[`$${name}/${member.slice(1)}`] = primitive;
    }
    return table;
}

/**
 * The names an `$include` brings into scope, added to `included` (name => { primitive, module }, or
 * { ambiguous: [modules] } when two modules of the list have the name). Also the set of names added.
 */
export function includeModules(included, modules, names, path) {
    if (!isArray(names) || !names.every(isString)) {
        throw new LambdaJSONError('invalid-include', path, `'$include' is a literal array of module names`);
    }
    const owners = new Map();
    for (const name of new Set(names)) {
        if (!Object.hasOwn(modules, name)) throw new LambdaJSONError('unknown-module', path, `'${name}' is not an injected module`);
        for (const member of Object.keys(modules[name])) owners.set(member, [...(owners.get(member) ?? []), name]);
    }
    const next = new Map(included);
    for (const [member, list] of owners) {
        next.set(member, list.length === 1 ? { primitive: modules[list[0]][member], module: list[0] } : { ambiguous: list });
    }
    return { included: next, names: new Set(owners.keys()) };
}

/** The error of a call of a name that several included modules have. */
export const ambiguous = (key, modules, path) => new LambdaJSONError('ambiguous-function', path,
    `'${key}' is a member of ${modules.map(m => `'${m}'`).join(' and ')}; call it qualified, e.g. '$${modules[0]}/${key.slice(1)}'`, { modules });

/** The error of a call of `$mod/name` where `mod` is not an injected module, or undefined. */
export function unknownModule(key, modules, path) {
    const [, name] = /^\$([^/]+)\/.+$/.exec(key) ?? [];
    return name !== undefined && MODULE_NAME.test(name) && !Object.hasOwn(modules, name)
        ? new LambdaJSONError('unknown-module', path, `'${name}' is not an injected module (in '${key}')`)
        : undefined;
}

/**
 * Reads the source of a module: `{ functions, exports?, signatures? }`.
 * @returns {{ functions: object, exports: string[], signatures: object }}
 */
export function parseSource(source) {
    if (!isPlainObject(source) || !isPlainObject(source.functions)) {
        throw new LambdaJSONError('invalid-module', '', `a module source is an object with 'functions'`);
    }
    const { functions } = source;
    for (const name of Object.keys(functions)) checkMemberName(name, pointer('/functions', name), 'a module function');
    let exports = Object.keys(functions);
    if (source.exports !== undefined) {
        if (!isArray(source.exports) || !source.exports.every(isString)) {
            throw new LambdaJSONError('invalid-module', '/exports', `'exports' is an array of function names`);
        }
        source.exports.forEach((name, i) => {
            if (!Object.hasOwn(functions, name)) throw new LambdaJSONError('unknown-export', pointer('/exports', i), `'${name}' is not a function of the module`);
        });
        exports = [...new Set(source.exports)];
    }
    const signatures = source.signatures ?? {};
    if (!isPlainObject(signatures)) throw new LambdaJSONError('invalid-module', '/signatures', `'signatures' is an object of { takes, returns }`);
    for (const name of Object.keys(signatures)) {
        if (!Object.hasOwn(functions, name)) throw new LambdaJSONError('unknown-signature', pointer('/signatures', name), `'${name}' is not a function of the module`);
    }
    return { functions, exports, signatures };
}

export const functionPath = name => pointer('/functions', name);
