import { isArray, isEqual, isPlainObject, isString, mapValues } from 'lodash-es';

/**
 * Types are JSON Schema objects restricted to: `type`, `const`, `enum`, `items`, `prefixItems`,
 * `properties`, `required`, `additionalProperties` and `anyOf`, plus the non-standard
 * `{ type: 'function' }`. `{}` is any value; a missing value is `{ type: 'null' }`.
 */
export const ANY = {};
export const NULL = { type: 'null' };
export const NUMBER = { type: 'number' };
export const STRING = { type: 'string' };
export const BOOLEAN = { type: 'boolean' };
export const FUNCTION = { type: 'function' };
export const ARRAY = { type: 'array' };
export const OBJECT = { type: 'object' };
export const NEVER = { enum: [] };

export const arrayOf = items => ({ type: 'array', items });
export const objectOf = additionalProperties => ({ type: 'object', additionalProperties });
export const tuple = prefixItems => ({ type: 'array', prefixItems, items: false });

export const isAny = t => Object.keys(t).length === 0;
export const members = t => t.anyOf ?? [t];
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * Reduces a JSON Schema (or a signature notation, see `toType`) to the supported subset.
 */
export function normalize(t) {
    if (t === false) return NEVER;
    if (!isPlainObject(t)) return ANY;
    if (isArray(t.anyOf)) return union(...t.anyOf.map(normalize));
    if (isArray(t.type)) return union(...t.type.map(type => normalize({ ...t, type })));
    const out = {};
    if (isString(t.type)) out.type = t.type === 'integer' ? 'number' : t.type;
    if ('const' in t) out.const = t.const;
    if (isArray(t.enum)) out.enum = t.enum;
    if (t.items !== undefined) out.items = t.items === false ? false : normalize(t.items);
    if (isArray(t.prefixItems)) out.prefixItems = t.prefixItems.map(normalize);
    if (isPlainObject(t.properties)) out.properties = mapValues(t.properties, normalize);
    if (isArray(t.required)) out.required = t.required;
    if (t.additionalProperties === false) out.additionalProperties = false;
    else if (isPlainObject(t.additionalProperties)) out.additionalProperties = normalize(t.additionalProperties);
    return out;
}

/**
 * Notation of a signature: `any`, `number`, `string`, `boolean`, `object`, `array`, `array<T>`,
 * `function`; anything else that is an object is a type.
 */
export function toType(notation) {
    if (isString(notation)) {
        const generic = /^array<(.+)>$/.exec(notation);
        if (generic) return arrayOf(toType(generic[1]));
        return { number: NUMBER, string: STRING, boolean: BOOLEAN, object: OBJECT, array: ARRAY, function: FUNCTION }[notation] ?? ANY;
    }
    return normalize(notation);
}

export function literalType(value) {
    if (value === null) return { type: 'null', const: null };
    if (isArray(value)) return tuple(value.map(literalType));
    if (isPlainObject(value)) {
        return { type: 'object', properties: mapValues(value, literalType), required: Object.keys(value), additionalProperties: false };
    }
    return { type: typeof value, const: value };
}

const valuesOf = m => 'const' in m ? [m.const] : m.enum ?? null;

const kindOfValue = v => v === null ? 'null' : isArray(v) ? 'array' : typeof v;

function kindsOf(m) {
    if (m.type !== undefined) return [m.type];
    const values = valuesOf(m);
    return values === null ? null : [...new Set(values.map(kindOfValue))];
}

export function valueMatches(v, t) {
    return members(t).some(m => matchOne(v, m));
}

function matchOne(v, m) {
    if (isAny(m)) return true;
    if (m.type !== undefined && m.type !== kindOfValue(v)) return false;
    const values = valuesOf(m);
    if (values && !values.some(x => isEqual(x, v))) return false;
    if (isArray(v)) {
        return v.every((item, i) => {
            const target = m.prefixItems?.[i] ?? (m.items === false ? null : m.items);
            return target === null ? false : target === undefined || valueMatches(item, target);
        });
    }
    if (isPlainObject(v)) {
        if ((m.required ?? []).some(k => !own(v, k))) return false;
        return Object.entries(v).every(([k, item]) => {
            const target = own(m.properties ?? {}, k) ? m.properties[k] : m.additionalProperties;
            return target === false ? false : target === undefined || valueMatches(item, target);
        });
    }
    return true;
}

/** Every value of `s` is a value of `t`; conservative: false when it can't be shown. */
export function assignable(s, t) {
    return members(s).every(a => members(t).some(b => assignableOne(a, b)));
}

function assignableOne(a, b) {
    if (isAny(b)) return true;
    if (isAny(a)) return false;
    const values = valuesOf(a);
    if (values) return values.every(v => matchOne(v, b));
    if (a.type === undefined || a.type !== b.type || valuesOf(b)) return false;
    if (a.type === 'array') return arrayAssignable(a, b);
    if (a.type === 'object') return objectAssignable(a, b);
    return true;
}

function arrayAssignable(a, b) {
    const aPrefix = a.prefixItems ?? [];
    const bPrefix = b.prefixItems ?? [];
    for (let i = 0; i < aPrefix.length; i++) {
        const target = bPrefix[i] ?? (b.items === false ? null : b.items ?? ANY);
        if (!target || !assignable(aPrefix[i], target)) return false;
    }
    if (a.items === false) return true;
    if (b.items === false) return false;
    const rest = a.items ?? ANY;
    return assignable(rest, b.items ?? ANY) && bPrefix.slice(aPrefix.length).every(t => assignable(rest, t));
}

function objectAssignable(a, b) {
    const aProps = a.properties ?? {};
    const bProps = b.properties ?? {};
    const aRequired = a.required ?? [];
    for (const [k, target] of Object.entries(bProps)) {
        if (own(aProps, k)) {
            if (!assignable(aProps[k], target)) return false;
        } else if ((b.required ?? []).includes(k) || (a.additionalProperties !== false && !assignable(a.additionalProperties ?? ANY, target))) {
            return false;
        }
    }
    if ((b.required ?? []).some(k => !aRequired.includes(k))) return false;
    const extra = Object.keys(aProps).filter(k => !own(bProps, k));
    if (b.additionalProperties === false) return a.additionalProperties === false && extra.length === 0;
    if (b.additionalProperties !== undefined) {
        return (a.additionalProperties === false || assignable(a.additionalProperties ?? ANY, b.additionalProperties))
            && extra.every(k => assignable(aProps[k], b.additionalProperties));
    }
    return true;
}

/** No value is both `s` and `t`. */
export function disjoint(s, t) {
    return members(s).every(a => members(t).every(b => disjointOne(a, b)));
}

function disjointOne(a, b) {
    if (isAny(a) || isAny(b)) return false;
    const ka = kindsOf(a);
    const kb = kindsOf(b);
    if (ka && kb && !ka.some(k => kb.includes(k))) return true;
    const va = valuesOf(a);
    const vb = valuesOf(b);
    if (va && vb) return !va.some(x => vb.some(y => isEqual(x, y)));
    if (va) return !va.some(v => matchOne(v, b));
    if (vb) return !vb.some(v => matchOne(v, a));
    return false;
}

/** The union of types, normalized: flat, without duplicates or members assignable to another. */
export function union(...types) {
    const result = [];
    for (const t of types) {
        if (isAny(t)) return ANY;
        for (const m of members(t)) {
            if (result.some(r => assignableOne(m, r))) continue;
            for (let i = result.length - 1; i >= 0; i--) {
                if (assignableOne(result[i], m)) result.splice(i, 1);
            }
            result.push(m);
        }
    }
    if (result.length === 0) return NEVER;
    return result.length === 1 ? result[0] : { anyOf: result };
}

export const orAny = t => isEqual(t, NEVER) ? ANY : t;

export function isNullable(t) {
    return !isAny(t) && members(t).some(m => kindsOf(m)?.includes('null'));
}

export function nonNull(t) {
    return union(...members(t).map(m => {
        if (m.enum) return { enum: m.enum.filter(v => v !== null) };
        return kindsOf(m)?.length === 1 && kindsOf(m)[0] === 'null' ? NEVER : m;
    }));
}

export const nullable = t => union(t, NULL);

/** The type of an element of an array type. */
export function itemOf(t) {
    const items = members(nonNull(t)).map(m => {
        if (m.type !== 'array') return ANY;
        if (m.prefixItems === undefined && m.items === undefined) return ANY;
        return union(...(m.prefixItems ?? []), ...(m.items === false ? [] : [m.items ?? ANY]));
    });
    return orAny(union(...items));
}

/** The type of a value of an object type. */
export function valueOf(t) {
    const values = members(nonNull(t)).map(m => {
        if (m.type !== 'object') return ANY;
        const add = m.additionalProperties;
        return union(...Object.values(m.properties ?? {}), ...(add === false ? [] : [add ?? ANY]));
    });
    return orAny(union(...values));
}

const expand = m => {
    if (m.type !== undefined) return [m];
    if ('const' in m) return [literalType(m.const)];
    return m.enum ? m.enum.map(literalType) : [m];
};

const describeKeys = props => Object.keys(props).join(', ') || 'none';

function walkMember(m, k) {
    if (isAny(m)) return { type: ANY };
    const numeric = /^\d+$/.test(k);
    switch (m.type) {
        case 'object': {
            const props = m.properties ?? {};
            if (own(props, k)) return { type: (m.required ?? []).includes(k) ? props[k] : nullable(props[k]) };
            if (m.additionalProperties === false) {
                return { error: `'${k}' is not a property of the object (declared: ${describeKeys(props)})` };
            }
            return { type: nullable(m.additionalProperties ?? ANY) };
        }
        case 'array': {
            if (numeric) {
                const prefix = m.prefixItems ?? [];
                if (Number(k) < prefix.length) return { type: prefix[Number(k)] };
                if (m.items === false) return { error: `index ${k} is beyond the tuple of ${prefix.length}` };
                return { type: nullable(m.items ?? ANY) };
            }
            return k === 'length' ? { type: NUMBER } : { error: `an array has no '${k}'` };
        }
        case 'string':
            if (k === 'length') return { type: NUMBER };
            return numeric ? { type: nullable(STRING) } : { error: `a string has no '${k}'` };
        default:
            return { error: `a ${m.type} has no '${k}'` };
    }
}

/** Walks one segment: `{ type }`, or `{ error }` when the segment can't exist. */
export function walkSegment(t, k) {
    const results = members(t).flatMap(expand).map(m => kindsOf(m)?.[0] === 'null' && kindsOf(m).length === 1
        ? { type: NULL, isNull: true }
        : walkMember(m, k));
    const real = results.filter(r => !r.isNull);
    if (real.length > 0 && real.every(r => r.error)) return { error: real[0].error };
    // a member where the segment can't exist yields a missing value at run time
    return { type: union(...results.filter(r => !r.error).map(r => r.type), ...(results.some(r => r.error) ? [NULL] : [])) };
}

/** Walks a path; calls `fail(message)` at the first impossible segment and continues with null. */
export function walkPath(t, segments, fail) {
    let current = t;
    for (const segment of segments) {
        const step = walkSegment(current, segment);
        if (step.error) {
            fail(step.error);
            return NULL;
        }
        current = step.type;
    }
    return current;
}

export function describe(t) {
    if (isAny(t)) return 'any';
    return members(t).map(m => {
        if ('const' in m) return JSON.stringify(m.const);
        if (m.enum) return m.enum.map(v => JSON.stringify(v)).join(' | ') || 'never';
        if (m.type === 'array' && m.items && m.items !== false) return `array<${describe(m.items)}>`;
        return m.type ?? 'any';
    }).join(' | ');
}
