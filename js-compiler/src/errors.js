/**
 * A problem in the structure of a program, found while compiling it.
 * `path` is a JSON Pointer to the offending node, `code` a stable identifier,
 * `data` extra facts (e.g. the modules of an ambiguous name).
 */
export class LambdaJSONError extends Error {
    constructor(code, path, message, data) {
        super(`${message} (at ${path || '/'})`);
        this.name = 'LambdaJSONError';
        this.code = code;
        this.path = path;
        if (data !== undefined) this.data = data;
    }
}
