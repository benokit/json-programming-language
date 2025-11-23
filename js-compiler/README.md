# LambdaJSON to JavaScript compiler

LambdaJSON is a JSON based pure functional programming language: [https://github.com/benokit/json-programming-language/tree/main](https://github.com/benokit/json-programming-language/tree/main)

## Quick start

```js
import { compile } from 'lambdajson-js';

const program = {
    $sum: ['#', 2]
};
const f = compile(program);

console.log(f(1)); // => 3
```

