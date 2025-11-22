# LambdaJSON

A pure, JSON-based programming language for safe transport and evaluation across system boundaries. Programs serialize as data and compile to deterministic JavaScript functions, making them ideal for HTTP communication, remote execution, and server-driven logic. This enables backends to ship executable rules, define dynamic workflows, and persist logic without exposing arbitrary code or inventing custom DSLs.

See examples in [tests](./test/test-js-compiler.js).

## Language definition

Structure: JSON

Elements:
- string
- number
- boolean
- array
- object
- variable declaration
- function declaration
- primitive functions
- anonymous functions
- recursion
- closure

Semantics:

- program is a direct representation of an execution tree as JSON
- properties:
    - property name with trailing `$` (e.g. `$sum`, `$return`) 
        - must correspond to a primitive function, check [here](./src/primitives.js)
        - or to a declared function in a preceding `$let` block
    - special property `$let` is reserved for local variables declaration and should always be placed in a node together with a function
    - property name with trailing `_` (e.g. `_with`) must correspond to a property of the preceding primitive function 
- values:
    - string
        - trailing `@` signals a reference to locally declared variables in a `$let` block, the following substring should correspond to a name of a variable and further to a pointer to a value in an object variable (e.g. `@address.street.number`)
        - trailing `#` corresponds to an input to a function in each node of the execution tree, the following substring should correspond to a value pointer in an input object (e.g. `#.name`). If input is an array, the elements of the array can be accessed by index up from 0 to max 9 by appending the index to `#` (e.g. for the first element in the input array `#0.name`). 
        - otherwise string is interpreted as a literal value
    - number
        - is interpreted as a literal value
    - array
        - each element of an array is evaluated and an array is returned
    - object
        - if properties correspond to primitive tokens, i.e. starting with `$`, the corresponding primitive function is executed
        - otherwise each property is evaluated separately and an evaluated object with the same properties is returned

## JS compiler

- [source](./src/js-compiler.js)
- converts a program (js object (parsed JSON)) into an executable js function
- inputs
    - program (object)
    - primitives (object - optional)
        - custom primitive functions that could be referenced in a program

For how to declare a custom primitive function [see](./src/primitives.js).