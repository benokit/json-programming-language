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
See the language documentation for the full reference and the migration notes from 1.x.
