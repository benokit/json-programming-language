import { isPlainObject } from 'lodash-es';

/**
 * Support of `$template`, a mapping returned as data with the names bound by `with` filled in.
 * The compiler and `infer` walk the mapping in "quote" mode; these are the rules they share.
 */

const NAMED = /^@([^.]+)(?:\.(.+))?$/;

/** `"@name"` or `"@name.path"` as { name, path }, or undefined for any other string. */
export const occurrence = text => {
    const [, name, path] = NAMED.exec(text) ?? [];
    return name === undefined ? undefined : { name, path };
};

/** A string that would be read as an expression gets a leading backslash. */
export const protectString = value => /^[#@\\]/.test(value) ? `\\${value}` : value;

/** A key that would be read as a call (`$`) or as an escape (`\`) gets a leading backslash. */
export const protectKey = key => /^[$\\]/.test(key) ? `\\${key}` : key;

export const protect = value => typeof value === 'string'
    ? protectString(value)
    : Array.isArray(value)
        ? value.map(protect)
        : isPlainObject(value)
            ? Object.fromEntries(Object.entries(value).map(([key, item]) => [protectKey(key), protect(item)]))
            : value;

/** The arguments of a `{ "$literal": … }` call are values: nothing in them is read as an expression. */
export const isLiteralCall = mapping => isPlainObject(mapping) && Object.hasOwn(mapping, '$literal');
