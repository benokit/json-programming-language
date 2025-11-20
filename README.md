# json-programming-language

A pure, JSON-based programming language for safe transport and evaluation across system boundaries. Programs serialize as data and compile to deterministic JavaScript functions, making them ideal for HTTP communication, remote execution, and server-driven logic. This enables backends to ship executable rules, define dynamic workflows, and persist logic without exposing arbitrary code or inventing custom DSLs.

See examples in [tests](./test/test-parser.js).

## Language definition

Structure: JSON
Elements:
- string
- number
- boolean
- array
- object
- variables declaration
- functions declaration
- primitive functions

Semantics:
- program is a direct representation of an execution tree
- properties:
    - property name with a trailing `$` (e.g. `$sum`, `$return`) 
        - must correspond to a primitive function or its arguments, check [here](./src/primitives.js)
        - or to a local function definition in the `$let` object
    - special property `$let` is reserved for local variables declaration and should be placed in a node together with another primitive function.
- values:
    - string
        - trailing `$` is a reference to the global function input, the following substring should be a pointer to a value in the input object (e.g. `$.`)
        - trailing `@` is a reference to locally declared variables and functions in a `$let` object, the following substring should correspond to a pointer to a variable and further with a pointer to a value in the property object (e.g. `@address.street.number`)
        - trailing `#` corresponds to a value passed to a primitive function in a node of the execution tree, the following substring should correspond to a value in the value object (e.g. `#.name`)
        - otherwise string is interpreted as a literal value
    - number
        - is interpreted as a literal value
    - array
        - each element of an array is evaluated and an array is returned
    - object
        - if properties correspond to primitive tokens, i.e. starting with `$`, the corresponding primitive function is executed
        - otherwise each property is evaluated separately and an evaluated object with the same properties is returned

## JS parser

Parser (implementation [see](./src/parser.js)):
- converts a program (js object (parsed JSON)) into an executable function
- inputs
    - program (js object)
    - primitives (js object)
        - custom primitive functions that could be used in a program
        - optional

For how to declare a custom primitive function [see](./src/primitives.js).