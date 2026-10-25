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

## Changes in 3.0

* **Breaking:** arithmetic (`$sum`, `$subtract`, `$multiply`, `$divide`) and ordering (`$lt`, `$lte`, `$gt`, `$gte`)
  throw `LambdaJSONRuntimeError` (`missing-operand`) on a `null` or `undefined` operand instead of passing it on.
* **Breaking:** `$eq` and `$neq` compare deeply, by value.
* Functions with named parameters: `{ "$let": { "$f": { "$fn": { "as": ["a", "b"], "body": … } } }, "$f": [1, 2] }`;
  `#` in the body stays the caller's input.
* New primitives: `$round`, `$min`, `$max`, `$count`, `$find`, `$unique`, `$pick`, `$omit`, `$lower`, `$upper`, `$trim`, `$isNil`.
* `signatureOf(name)` returns the declared types of a primitive; `typed(primitive, { takes, returns })` declares them for custom ones.
