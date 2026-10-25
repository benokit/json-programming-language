# LambdaJSON to JavaScript compiler

LambdaJSON is a JSON based pure functional programming language: [https://github.com/benokit/json-programming-language/tree/main](https://github.com/benokit/json-programming-language/tree/main)

## Quick start

```js
import { compile, lint } from 'lambdajson-js';

const program = {
    $map: {
        over: '#.lines',
        as: 'line',
        fn: { $str: ['@line.name', ' x', { $multiply: ['@line.quantity', '#.factor'] }] }
    }
};
const f = compile(program);

console.log(f({ factor: 2, lines: [{ name: 'bolt', quantity: 3 }] })); // => ['bolt x6']

lint({ $str: ['\\ needless escape'] }); // => [{ severity: 'warning', code: 'needless-escape', … }]
```

`compile` throws a `LambdaJSONError` (with `code` and a JSON Pointer `path`) for a malformed program.
Problems found while a program runs throw a `LambdaJSONRuntimeError` (also with `code` and `path`).
See the language documentation for the full reference and the migration notes.

## Type inference

`infer(program, { input, vars, primitives })` returns `{ type, problems }`: the JSON Schema type of the result
and the errors and warnings (impossible paths, possibly missing operands, mismatched arguments, impossible
comparisons, unbound variables) found from the type of the input, without running the program.
See the language documentation.

## Changes in 3.1.1

* `infer`: an impossible segment in some members of a union yields a missing value (`T | null`) instead of being dropped.
* `infer`: the names of `as` are bound to any value in the arguments of a primitive whose parameters aren't typed.
* `$get`, `$keys` and `$values` are typed to accept arrays as well as objects; `$get`'s `path` may be a number.
* `infer`: `$merge` with an operand of unknown type is open, and earlier properties become unknown.

## Changes in 3.1

* `infer(program, { input, vars, primitives })`: type inference with errors and warnings before a program runs.
* `typed(primitive, signature, infer?)` accepts JSON Schema types as well as notation.

## Changes in 3.0

* **Breaking:** arithmetic (`$sum`, `$subtract`, `$multiply`, `$divide`) and ordering (`$lt`, `$lte`, `$gt`, `$gte`)
  throw `LambdaJSONRuntimeError` (`missing-operand`) on a `null` or `undefined` operand instead of passing it on.
* **Breaking:** `$eq` and `$neq` compare deeply, by value.
* Functions with named parameters: `{ "$let": { "$f": { "$fn": { "as": ["a", "b"], "body": … } } }, "$f": [1, 2] }`;
  `#` in the body stays the caller's input.
* New primitives: `$round`, `$min`, `$max`, `$count`, `$find`, `$unique`, `$pick`, `$omit`, `$lower`, `$upper`, `$trim`, `$isNil`.
* `signatureOf(name)` returns the declared types of a primitive; `typed(primitive, { takes, returns })` declares them for custom ones.
