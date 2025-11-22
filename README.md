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
* `array`
* `object`

On top of that, LambdaJSON defines **conventions on property names and string suffixes** which give these values operational semantics.

### Property name conventions

* **Primitive or user-defined function call**

  A property whose name begins with `$` (for example `$sum`, `$return`) denotes a function call:

  * It must correspond either to:
    * a **primitive function** (one of the provided primitives), or
    * a **locally declared function** in a preceding `$let` block.
  * The value associated with this property is the argument(s) to the function.

* **Local bindings**

  Special property `$let` is reserved for **local variable and function declarations** and must appear in the same object together with a function call.

* **Function configuration**

  A property whose name ends with `_` (for example `_with`) must correspond to a **configuration property** of the function called in the same object.

  The exact set of supported config properties is defined per primitive (see `src/primitives.js`).

### String value conventions

String values are interpreted according to their prefix:

* **`@` — local variable reference**

  A string starting with `@` is a reference to a variable declared in a preceding `$let` block anywhere up in the execution tree.
  The substring following `@` is treated as a dotted path into the bound value.

  Example: `"@address.street.number"`.

* **`#` — input reference**

  A string starting with `#` refers to the function input.
  The substring following `#` is interpreted as a dotted path into the input object.

  Example (object input): `"#.name"`
  Example (array input, index 0–9): `"#0.name"`.

* **other strings** are treated as literal values.

### Evaluation rules (informal)

* **Numbers / booleans**
  Evaluated as themselves.

* **Arrays**
  Each element is evaluated; the result is an array of evaluated elements.

* **Objects**

  * If any property name starts with `$`, the object is treated as a **function call node**:

    * the corresponding primitive or user-defined function is executed.
    * additional `_`-prefixed properties in the value associated with the function property provide configuration.
    * `$let` may provide local declarations.
  * Otherwise, each property is evaluated independently and the resulting object with evaluated properties is returned.

Programs are thus **direct representations of execution trees**: each object with a `$…` property represents one node in the tree.

---

## Examples

### 1. Pure expression: sum of two inputs

Compute `input.a + input.b` using the `$sum` primitive and `$return`:

```json
{
    "$sum": ["#.a", "#.b"]
}
```

Compiled to JS and invoked:

```js
const program = {
    "$sum": ["#.a", "#.b"]
};

const f = compile(program);

f({ a: 2, b: 3 }); // => 5
```

---

### 2. Using `$let` and local variables

Bind an intermediate value and reuse it twice:

```json
{
  "$let": {
    "base": {
      "$sum": [1, 2]
    }
  },
  "$sum": ["@base", "@base"]
}
```

Explanation:

* `$let.base` defines a local variable `base` with value `1 + 2 = 3`.
* returned value is `base + base = 6`.

---

### 3. Mapping over an input array

Assuming a primitive that can map a function over an array (e.g. `$map`) and a primitive `$sum`, we can increment each value in the input array by 1:

```json
{
  "$map": {
    "_fn": {
      "$sum": ["#.value", 1]
    },
    "_over": "#"
  }
}
```

Intended meaning (in JS-ish pseudocode):

```js
input.map(value => value + 1)
```

---

### 4. Nested objects and input paths

Picking and transforming fields from an input object:

```json
{
  "fullName": {
    "$join": {
        "_separator": " ", 
        "_strings":  ["#.firstName", "#.lastName"]
    }
  },
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

---

## Custom primitives

You can extend LambdaJSON by adding custom primitives and passing them to the compiler.

Example primitive: `$multiply`, taking two arguments:

```js
const multiply = f => x => {
  const [x, y] = f(x);
  return x * y;
};

const customPrimitives = {
  "$multiply": multiply
};

const program = {
  "$return": {
    "$multiply": [2, 3]
  }
};

const f = compile(program, customPrimitives);
f([2, 3]); // => 6
```

---

## JS compiler

The JS compiler:

* lives in [`src/js-compiler.js`](./src/js-compiler.js),
* takes a program (parsed JSON) and a set of primitives,
* returns a JavaScript function `(input) => output`.

High-level API:

```js
import { compile } from "./src/js-compiler.js";
import { primitives } from "./src/primitives.js";

const program = ...;
const customPrimitives = ...
const f = compile(program, customPrimitives);
const result = f(input);
```

---

## Testing

Tests are in [`test/test-js-compiler.js`](./test/test-js-compiler.js).

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