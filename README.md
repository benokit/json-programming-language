# LambdaJSON

LambdaJSON is a pure, JSON-based programming language.  
Programs are JSON values that represent execution trees and compile to deterministic JavaScript functions.

Because programs are just data, they can be:

- safely transported over HTTP,
- stored in databases,
- versioned and diffed as JSON,
- executed on the server with a controlled set of primitive functions.

This makes LambdaJSON useful for server-driven business rules, dynamic workflows, and “logic as data” scenarios.

---

## Quick start

Install dependencies and run tests:

```bash
cd ./js-compiler
npm install
npm test
```

Use the JS compiler directly:

```js
import { compile } from "./src/js-compiler.js";

// A minimal LambdaJSON program
const program = {
  "$sum": "#"
};

const f = compile(program);

// f is a pure function from input -> output
console.log(f([1, 2 ,3]));  // => 1 + 2 + 3 = 6 
```

---

## Core language model

### Data model

LambdaJSON programs are plain JSON values. They are built from standard JSON types:

* `string`
* `number`
* `boolean`
* `null`
* `array`
* `object`

On top of that, LambdaJSON defines **conventions on property names and string prefixes** which give these values operational semantics.

### Code and data

The rule is one character: **an object with a key starting with `$` is a call; every other object is data.**

* A **call** has exactly one call key, optionally beside `$let`:

  ```json
  { "$sum": ["#.a", "#.b"] }
  { "$let": { "base": 3 }, "$sum": ["@base", "@base"] }
  ```

  The call key names a **primitive** or a **function declared in an enclosing `$let`**.
  Anything else is a compile error: an unknown name, two calls in one object, or a `$` key beside plain keys.

* A **plain object** is evaluated key by key. To produce a key starting with `$`, escape it with `\`:
  `{ "\\$id": "#.id", "name": "#.name" }` produces `{ "$id": …, "name": … }`.

* `{ "$literal": <value> }` evaluates to `<value>` as-is, without interpreting it.

### Calling conventions

Each primitive takes one argument. A primitive either takes it **as an expression** (`$sum`, `$head`, `$str`, …)
or **declares named parameters** (`$map`, `$join`, `$get`, …), passed as an object:

```json
{ "$map": { "over": "#.lines", "fn": { "$sum": ["#", 1] } } }
```

Unknown or missing parameters are compile errors. Parameters with a default of the input (marked `=#` in the
reference below) may be left out. Before version 2 named parameters were written with a leading `_`
(`"_over"`); that spelling is no longer accepted.

### String values

* **`#`, input reference.** `"#"` is the input, `"#.name"` a dotted path into it, `"#0.name"` an index (0–9) followed by a path.
* **`@`, local reference.** `"@total"` or `"@line.price"` reads a name bound by `$let` or by a lambda's `as`.
* **`\`, escape.** The leading `\` is dropped: `"\\#.name"` is the string `"#.name"`. Only strings starting
  with `#`, `@` or `\` need it; `lint` reports needless escapes.
* **Any other string** is a literal value.

### Local bindings: `$let`

`$let` binds names for the call beside it and everything inside it. Bindings are evaluated in order, so a
binding can use earlier ones. A key starting with `$` declares a function, whose input `#` is its argument:

```json
{
  "$let": {
    "base": { "$sum": [1, 2] },
    "$double": { "$multiply": ["#", 2] }
  },
  "$double": "@base"
}
```

evaluates to `6`. Functions may call themselves and each other.

### Lambdas and named parameters: `as`

Higher-order primitives (`$map`, `$filter`, `$fold`, …) run a lambda per item. By default the item becomes the
lambda's input `#`. With `as`, the lambda's arguments get names instead, and `#` stays the input of the
enclosing expression, like `(fn [line] …)` in Lisp:

```json
{
  "$map": {
    "over": "#.lines",
    "as": "line",
    "fn": { "$multiply": ["@line.quantity", "#.priceFactor"] }
  }
}
```

`as` is a name or an array of names bound to the lambda's arguments in order:

| primitive | arguments |
|---|---|
| `$map`, `$filter`, `$any`, `$all` | item, index |
| `$mapValues` | value, key |
| `$fold` | accumulator, item |
| `$zip` | item of the first sequence, item of the second |
| `$group`, `$toDictionary`, `$ascending`, `$descending`, `$take`, `$apply` | item |

```json
{ "$fold": { "collection": "#.items", "as": ["total", "item"], "init": 0, "with": { "$sum": ["@total", "@item.price"] } } }
```

Without `as`, `$fold` and `$zip` pass the pair as `#`, read as `#0` and `#1`.

### Conditionals and logic

* `{ "$if": [test, then, else] }`: the `else` is optional and defaults to `null`. Only the chosen branch is evaluated.
* `{ "$cond": [[test, value], …] }`: the value of the first clause whose test is truthy, or `null`.
  The string `"else"` is truthy, so `["else", value]` reads as a default clause.
* `{ "$and": [a, b, …] }` and `{ "$or": [a, b, …] }` short-circuit and return the deciding value, like `&&` and `||`.
  `$and` of nothing is `true`, `$or` of nothing is `false`. Given an expression instead of an array, they apply to the array it evaluates to.
* `{ "$not": x }` is the boolean negation (`$negate` is the same).

```json
{
  "$cond": [
    [{ "$lt": ["#.age", 13] }, "child"],
    [{ "$lt": ["#.age", 18] }, "teen"],
    ["else", "adult"]
  ]
}
```

### Strings

`{ "$str": [a, b, …] }` concatenates its values; `null` and missing values become `""`, objects become JSON.

```json
{ "$str": ["#.id", " has no trait ", "#.trait"] }
```

`$join` joins with a separator, `$printf` formats a template.

---

## Primitives

`name` is required, `name=#` defaults to the input, `name?` is optional.

| primitive | argument |
|---|---|
| `$return`, `$in` | expression, returned as is |
| `$` | expression: a lambda `v => …` with `v` as `#`, used in `$pipeline` |
| `$pipeline` | array of lambdas, applied to the input in turn |
| `$apply` | `{ fn, to=#, as? }` |
| `$if`, `$cond`, `$and`, `$or` | see above |
| `$not`, `$negate` | expression |
| `$eq`, `$neq`, `$lt`, `$lte`, `$gt`, `$gte` | `[a, b]` |
| `$sum` | array of numbers |
| `$subtract`, `$multiply`, `$divide` | `[a, b]` |
| `$map` | `{ fn, over=#, as? }` |
| `$mapValues` | `{ fn, of=#, as? }` |
| `$filter`, `$any`, `$all` | `{ predicate, collection=#, as? }` |
| `$group`, `$toDictionary` | `{ by, collection=#, as? }` |
| `$ascending`, `$descending` | `{ by?, collection=#, as? }` |
| `$take` | `{ while?, count?, from=#, as? }` |
| `$zip` | `{ with?, sequences=#, as? }` |
| `$fold` | `{ with, init?, collection=#, as? }` |
| `$head`, `$tail`, `$concat`, `$keys`, `$values`, `$merge`, `$coalesce` | expression |
| `$get` | `{ object=#, path }` |
| `$includes` | `{ collection=#, value }` |
| `$str` | expression or array |
| `$join` | `{ separator?, strings=# }` |
| `$split` | `{ separator, string=# }` |
| `$match`, `$isMatch` | `{ pattern, string=# }` |
| `$replace` | `{ regex, substitute, string=#, global? }` |
| `$printf` | `{ template, args=# }` |
| `$parseInt`, `$parseFloat` | expression |
| `$literal` | any value, not evaluated |

---

## Errors and lint

`compile` checks the structure of a program and throws a `LambdaJSONError` for the first problem.
The error has a `code` (for example `unknown-function`, `mixed-call`, `unknown-parameter`) and a `path`,
a JSON Pointer to the offending node.

`lint(program, primitives)` returns every problem without throwing: the structural error, if any, and
warnings for needless escapes.

```js
import { lint } from "lambdajson-js";

lint({ "$str": ["\\ has no trait ", "#.trait"] });
// => [{ severity: "warning", code: "needless-escape", path: "/$str/0", message: "the string ' has no trait ' needs no escape" }]
```

---

## Examples

### Picking and transforming fields

```json
{
  "fullName": { "$join": { "separator": " ", "strings": ["#.firstName", "#.lastName"] } },
  "streetNumber": "#.address.street.number",
  "tags": ["vip", "#.segment"]
}
```

On input

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "address": { "street": { "number": 42 } },
  "segment": "premium"
}
```

the program evaluates to:

```json
{
  "fullName": "Ada Lovelace",
  "streetNumber": 42,
  "tags": ["vip", "premium"]
}
```

### Recursion

```json
{
  "$let": {
    "$fib": {
      "$if": [
        { "$lte": ["#", 2] },
        1,
        { "$sum": [{ "$fib": { "$subtract": ["#", 1] } }, { "$fib": { "$subtract": ["#", 2] } }] }
      ]
    }
  },
  "$fib": "#"
}
```

---

## Custom primitives

Pass custom primitives to the compiler. A primitive taking its argument as an expression is a function
from the compiled argument to a function of the scope `x` (the argument is evaluated with `f(x)`):

```js
const customPrimitives = {
  "$product": f => x => f(x).reduce((a, b) => a * b, 1)
};

compile({ "$product": "#" }, customPrimitives)([2, 3, 4]); // => 24
```

A primitive with named parameters declares them with `named`. Lambdas are called with `call`, which binds `as`:

```js
import { compile, named, call } from "lambdajson-js";

const customPrimitives = {
  "$count": named(["predicate", "collection=#", "as?"], ({ predicate, collection, as }) => x =>
    collection(x).filter(v => call(predicate, as, x, [v])).length)
};
```

`special(form)` defines a special form: `form(rawArgument, context)` compiles the parts it needs with
`context.compile(tree, ...pathSteps)` and reports problems with `context.fail(message)`. `$if` and `$and` are built this way.

---

## Migrating from 1.x

* Drop the `_` from named parameters: `{ "_strings": … }` becomes `{ "strings": … }`. The old spelling is a compile error (`unknown-parameter`) whose message names the new one.
* `$conditional` is removed: `{ "$conditional": { "_if": t, "_then": a, "_else": b } }` becomes `{ "$if": [t, a, b] }`, and nested conditionals read better as `$cond`. String-building `$join`s read better as `$str`.
* An object with a `$` key beside other keys used to be a plain object; it is now an error. Escape the key (`"\\$id"`) if a plain object was meant.
* Calls to undeclared functions, unknown parameters and missing required parameters are now compile errors instead of failures at run time.
* A custom primitive that is a plain function always receives its argument as one compiled expression; an object with `_` keys is plain data. Declare named parameters with `named(params, impl)` instead.

---

## JS compiler

The JS compiler:

* lives in [`src/js-compiler.js`](./js-compiler/src/js-compiler.js),
* takes a program (parsed JSON) and a set of primitives,
* returns a JavaScript function `(input) => output`.

High-level API:

```js
import { compile, lint } from "./src/js-compiler.js";

const program = ...;
const customPrimitives = ...
const f = compile(program, customPrimitives);
const result = f(input);
```

---

## Testing

Tests are in [`test/test-js-compiler.js`](./js-compiler/test/test-js-compiler.js).

Run them with:

```bash
npm test
```

Those tests include more involved examples of LambdaJSON programs and their expected outputs; they’re a good reference for the current feature set.

---

## Status

Experimental. The language, primitives, and compiler API may change without notice.

---

## License

MIT