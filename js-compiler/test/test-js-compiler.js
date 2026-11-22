
import { expect } from 'chai';
import { compile, compileModule, typeModule, lint, infer, typed, named, signatureOf, LambdaJSONError, LambdaJSONRuntimeError } from '../src/js-compiler.js'

function example(description, { program, cases, input, output }, only = false) {
    const q = only ? it.only : it;
    q (description, () => {
        const f = compile(program);
        if (!cases) {
            cases = [{ input, output }]
        }
        for (const { input, output } of cases) {
            expect(f(input)).to.deep.equal(output);
        }
    });
}

describe('pure json programming language', () => {

    example('trivial', {
        program: {},
        input: 'anything',
        output: {}
    });

    example('identity function', {
        program: {
            $return: '#'
        },
        input: 'something',
        output: 'something'
    });

    example ('constant function - string', {
        program: {
            $return: 'test'
        },
        input: 'anything',
        output: 'test'
    });

    example ('constant function - object', {
        program: {
            $return: {
                test: 'test'
            }
        },
        input: 'anything',
        output: {
            test: 'test'
        }
    });

    example ('constant function - number ', {
        program: {
            $return: 1.1
        },
        input: 'anything',
        output: 1.1
    });

    example ('map object to object', {
        program: {
            name: '#.person.name',
            age: '#.age',
            const: 1
        },
        input: {
            person: {
                name: 'Ben'
            },
            age: 21
        },
        output: {
            name: 'Ben',
            age: 21,
            const: 1
        }
    });

    example ('sum numbers', {
        program: {
            $sum: '#'
        },
        input: [1, 2, 3],
        output: 1 + 2 + 3
    });

    example ('add constant to a number', {
        program: {
            $sum: [1, '#']
        },
        input: 1,
        output: 1 + 1
    });

    example ('apply function', {
        program: {
            $apply: {
                fn: {
                    $sum: [1, '#']
                },
                to: '#'
            }
        },
        input: 1,
        output: 1 + 1
    });

    example ('check equality', {
        program: {
            $eq: [ '#.a', '#.b' ]
        },
        cases: [
            {
                input: { a: 1, b: 2 },
                output: false
            },
            {
                input: { a: 1, b: 1 },
                output: true
            }
        ]
    });

    example ('conditional if-else', {
        program: {
            $if: [{ $eq: '#' }, 1, 0]
        },
        cases: [
            {
                input: [1, 2],
                output: 0
            },
            {
                input: [1, 1],
                output: 1
            }
        ]
    });

    example ('declare variable', {
        program: {
            $let: {
                a: '#',
                b: {
                    $sum: ['@a', '@a']
                }
            },
            $sum: [1, '@b']
        },
        input: 1,
        output: 3
    });

    example ('declare function (recursive)', {
        program: {
            $let: {
                $fib: {
                    $if: [
                        { $lte: ['#', 2] },
                        1,
                        {
                            $sum: [
                                {
                                    $fib: {
                                        $subtract: ['#', 1]
                                    } 
                                },
                                {
                                    $fib: {
                                        $subtract: ['#', 2]
                                    } 
                                }
                            ]
                        }
                    ]
                }
            },
            $fib: '#'
        },
        input: 6,
        output: 8
    });

    example ('map function over array', {
        program: {
            $map: {
                fn: {
                    $sum: ['#', '#']
                },
                over: '#'
            }
        },
        input: [1, 2, 3],
        output: [2, 4, 6]
    });

    example ('multiply', {
        program: {
            $let: {
                $square: {
                    $multiply: ['#', '#']
                }
            },
            $square: '#'
        },
        input: 3,
        output: 9
    });

    example ('filter array', {
        program: {
            $filter: {
                predicate: {
                    $lte: ['#', 10]
                },
                collection: '#'
            }
        },
        input: [1, 11, 2, 12, 3, 13],
        output: [1, 2, 3]
    });

    example ('take elements from an array', {
        program: {
            $take: {
                while: {
                    $lte: ['#', 5]
                },
                count: 5,
                from: '#'
            }
        },
        cases: [
            {
                input: [1, 3, 2, 4, 1, 1, 5, 13, 12],
                output: [1, 3, 2, 4, 1]
            },
            {
                input: [1, 3, 2, 14, 1, 1, 5, 13, 12],
                output: [1, 3, 2]
            }
        ]
    });

    example ('zip', {
        program: {
            $zip: {
                sequences: ['#', '#']
            }
        },
        input: [1, 3, 2],
        output: [[1, 1], [3, 3], [2, 2]]
    }); 

    example ('zip with', {
        program: {
            $zip: {
                with: { $multiply: ['#0', '#1'] },
                sequences: ['#', '#']
            }
        },
        input: [1, 3, 2],
        output: [1, 9, 4]
    }); 

    example ('pipeline with $let', {
        program: {
            $let: {
                a0: '#',
                a1: { $sum: [ '@a0', 1 ] },
                a2: { $multiply: [ '@a1', 2 ] },
                a3: { $subtract: [ '@a2', 4 ] },
            },
            $return: '@a3'
        },
        input: 2,
        output: 2
    });

    example ('nested function', {
        program: {
            $negate: {
                $negate: '#'
            }
        },
        input: true,
        output: true
    });

    example ('nested declared function', {
        program: {
            $let: {
                $addOne: { $sum: ['#', 1] },
            },
            $addOne: {
                $addOne: '#'
            }
        },
        input: 1,
        output: 3
    });

    example ('pipeline (use of anonymous functions (lambda))', {
        program: {
            $pipeline: [
                { $: { $sum: ['#', 1] }},
                { $: { $multiply: ['#', 2] }},
                { $: { $subtract: ['#', 4] }}
            ]
        },
        cases: [
            {
                input: 2,
                output: 2
            },
            {
                input: 3,
                output: 4
            }
        ]
    });

    example ('fold (reduce)', {
        program: {
            $fold: {
                with: {
                    $sum: ['#0', '#1']
                }
            }
        },
        input: [1, 2, 3],
        output: 6
    });

    example ('fold (reduce) with initial value', {
        program: {
            $fold: {
                with: {
                    $sum: ['#0', '#1']
                },
                init: -6
            }
        },
        input: [1, 2, 3],
        output: 0
    });

    example ('group by', {
        program: {
            $group: {
                by: '#.country'
            }
        },
        input: [{ name: 'a', country: 'x' }, { name: 'b', country: 'y'}, { name: 'c', country: 'x' }],
        output: {
            'x': [{ name: 'a', country: 'x' }, { name: 'c', country: 'x' }],
            'y': [ { name: 'b', country: 'y'} ]
        }
    });

    example ('to dictionary', {
        program: {
            $toDictionary: {
                by: '#.name'
            }
        },
        input: [{ name: 'a', country: 'x' }, { name: 'b', country: 'y'}, { name: 'c', country: 'x' }],
        output: {
            'a': { name: 'a', country: 'x' },
            'b': { name: 'b', country: 'y' },
            'c': { name: 'c', country: 'x' }
        }
    });

    example ('concatenate arrays', {
        program: {
            $concat: '#'
        },
        input: [[1, 2], [3], [4, 5]],
        output: [1, 2, 3, 4, 5]
    });

    example ('divide', {
        program: {
            $divide: ['#', 2]
        },
        input: 1,
        output: 0.5
    });

    example ('match pattern in a string', {
        program: {
            $pipeline: [
                {$:{
                    $match: {
                        pattern: '^(\\d{4})-(\\d{2}-\\d{2})'
                    }
                }},
                {$:{
                    $tail: '#'
                }}
            ]
        },
        input: '2025-01-01',
        output: ['2025', '01-01']
    });

    example ('printf', {
        program: {
            $printf: {
                template: 'ABC-%04d/%d'
            }
        },
        input: [12, 2025],
        output: 'ABC-0012/2025'
    });

    example ('any', {
        program: {
            $any: {
                predicate: { $gt: ['#', 3] }
            }
        },
        input: [1, 2, 4],
        output: true
    });

    example ('all', {
        program: {
            $all: {
                predicate: { $gt: ['#', 0] }
            }
        },
        input: [1, 2, 3],
        output: true
    });

    example ('coalesce', {
        program: { $coalesce: '#' },
        input: [null, undefined, 42, 'ignored'],
        output: 42
    });

    example ('merge', {
        program: { $merge: '#' },
        input: [{ a: 1, b: 2 }, { b: 3, c: 4 }],
        output: { a: 1, b: 3, c: 4 }
    });

    example ('keys', {
        program: { $keys: '#' },
        input: { a: 1, b: 2, c: 3 },
        output: ['a', 'b', 'c']
    });

    example ('includes', {
        program: {
            $includes: {
                collection: '#.items',
                value: '#.target'
            }
        },
        input: { items: ['a', 'b', 'c'], target: 'b' },
        output: true
    });

    example ('get value at path', {
        program: {
            $get: {
                path: 'a.b'
            }
        },
        input: { a: { b: 42 } },
        output: 42
    });

    example ('get value at path with explicit object', {
        program: {
            $get: {
                object: '#.data',
                path: 'a.b'
            }
        },
        input: { data: { a: { b: 42 } } },
        output: 42
    });

    example ('string join', {
        program: {
            $join: {
                separator: '-'
            }
        },
        input: [2025, '01-01'],
        output: '2025-01-01'
    });

    example ('string join default separator', {
        program: {
            $join: {}
        },
        input: ['foo', 'bar', 'baz'],
        output: 'foobarbaz'
    });

    example ('compile not plain object - string', {
        program: '#.value',
        input: {
            value: { a: 1 }
        },
        output: { a: 1 }
    });

    example ('compile not plain object - number', {
        program: 2.1,
        input: {},
        output: 2.1
    });

    example ('literal', {
        program: {
            $literal: '#.value'
        },
        input: {
            value: { a: 1 }
        },
        output: '#.value'
    });

    example ('escape # in string value', {
        program: {
            $return: '\\#.name'
        },
        input: { name: 'anything' },
        output: '#.name'
    });

    example ('escape @ in string value', {
        program: {
            $return: '\\@var'
        },
        input: {},
        output: '@var'
    });

    example ('escape \\ in string value', {
        program: {
            $return: '\\\\'
        },
        input: {},
        output: '\\'
    });

    example ('escape $ in property name', {
        program: {
            '\\$name': '#'
        },
        input: 'test',
        output: { '$name': 'test' }
    });

    example ('escape \\ in property name', {
        program: {
            '\\\\_data': '#'
        },
        input: 42,
        output: { '\\_data': 42 }
    });

    example ('replace first occurrence', {
        program: {
            $replace: {
                regex: 'o',
                substitute: '0'
            }
        },
        input: 'foobar',
        output: 'f0obar'
    });

    example ('parseInt', {
        program: { $parseInt: '#' },
        cases: [
            { input: '42',  output: 42 },
            { input: 'abc', output: undefined }
        ]
    });

    example ('parseFloat', {
        program: { $parseFloat: '#' },
        cases: [
            { input: '3.14', output: 3.14 },
            { input: 'abc',  output: undefined }
        ]
    });

    example ('isMatch', {
        program: {
            $isMatch: {
                pattern: '^\\d+$'
            }
        },
        cases: [
            { input: '123',  output: true },
            { input: '12x3', output: false }
        ]
    });

    example ('replace all occurrences', {
        program: {
            $replace: {
                regex: 'o',
                substitute: '0',
                global: true
            }
        },
        input: 'foobar',
        output: 'f00bar'
    });

    example ('strip quotes then parse integer', {
        program: {
            $parseInt: {
                $replace: {
                    regex: '"',
                    substitute: '',
                    global: true
                }
            }
        },
        input: '"42"',
        output: 42
    });

    example ('replace with explicit string', {
        program: {
            $replace: {
                string: '#.text',
                regex: '#.from',
                substitute: '#.to'
            }
        },
        input: { text: 'hello world', from: 'world', to: 'there' },
        output: 'hello there'
    });

    example ('ascending sort of numbers', {
        program: { $ascending: {} },
        input: [3, 1, 4, 1, 5, 9, 2, 6],
        output: [1, 1, 2, 3, 4, 5, 6, 9]
    });

    example ('descending sort of numbers', {
        program: { $descending: {} },
        input: [3, 1, 4, 1, 5, 9, 2, 6],
        output: [9, 6, 5, 4, 3, 2, 1, 1]
    });

    example ('ascending sort by property', {
        program: {
            $ascending: { by: '#.age' }
        },
        input: [{ name: 'Charlie', age: 30 }, { name: 'Alice', age: 25 }, { name: 'Bob', age: 28 }],
        output: [{ name: 'Alice', age: 25 }, { name: 'Bob', age: 28 }, { name: 'Charlie', age: 30 }]
    });

    example ('descending sort by property', {
        program: {
            $descending: { by: '#.age' }
        },
        input: [{ name: 'Charlie', age: 30 }, { name: 'Alice', age: 25 }, { name: 'Bob', age: 28 }],
        output: [{ name: 'Charlie', age: 30 }, { name: 'Bob', age: 28 }, { name: 'Alice', age: 25 }]
    });

    example ('ascending sort with explicit collection', {
        program: {
            $ascending: { collection: '#.items' }
        },
        input: { items: [5, 2, 8, 1] },
        output: [1, 2, 5, 8]
    });

    describe('named lambda parameters (as)', () => {
        example('map with a named item keeps # as the outer input', {
            program: {
                $map: {
                    over: '#.lines',
                    as: 'line',
                    fn: { $multiply: ['@line.quantity', '#.factor'] }
                }
            },
            input: { factor: 10, lines: [{ quantity: 1 }, { quantity: 2 }] },
            output: [10, 20]
        });

        example('map binds the index as a second name', {
            program: { $map: { as: ['item', 'index'], fn: { $str: ['@index', ':', '@item'] } } },
            input: ['a', 'b'],
            output: ['0:a', '1:b']
        });

        example('fold with named accumulator and item', {
            program: {
                $fold: {
                    collection: '#.items',
                    as: ['total', 'item'],
                    init: 0,
                    with: { $sum: ['@total', { $multiply: ['@item', '#.weight'] }] }
                }
            },
            input: { weight: 2, items: [1, 2, 3] },
            output: 12
        });

        example('filter with a named item', {
            program: { $filter: { collection: '#.values', as: 'v', predicate: { $gt: ['@v', '#.min'] } } },
            input: { min: 2, values: [1, 2, 3, 4] },
            output: [3, 4]
        });

        example('zip with named pair', {
            program: { $zip: { as: ['a', 'b'], with: { $sum: ['@a', '@b'] } } },
            input: [[1, 2], [10, 20]],
            output: [11, 22]
        });

        example('nested lambdas see each other by name', {
            program: {
                $map: {
                    over: '#.rows', as: 'row',
                    fn: { $map: { over: '@row', as: 'cell', fn: { $multiply: ['@cell', '#.scale'] } } }
                }
            },
            input: { scale: 3, rows: [[1, 2], [3]] },
            output: [[3, 6], [9]]
        });

        example('mapValues, group, sort and any with as', {
            program: {
                doubled: { $mapValues: { of: '#.prices', as: 'p', fn: { $multiply: ['@p', 2] } } },
                byParity: { $group: { collection: '#.numbers', as: 'n', by: { $if: [{ $eq: [{ $divide: ['@n', 2] }, { $parseInt: { $divide: ['@n', 2] } }] }, 'even', 'odd'] } } },
                sorted: { $descending: { collection: '#.people', as: 'p', by: '@p.age' } },
                hasAdult: { $any: { collection: '#.people', as: 'p', predicate: { $gte: ['@p.age', '#.adult'] } } }
            },
            input: { adult: 18, prices: { a: 1, b: 2 }, numbers: [1, 2, 3], people: [{ age: 9 }, { age: 30 }] },
            output: {
                doubled: { a: 2, b: 4 },
                byParity: { odd: [1, 3], even: [2] },
                sorted: [{ age: 30 }, { age: 9 }],
                hasAdult: true
            }
        });
    });

    describe('everyday forms', () => {
        example('$and short-circuits and returns the deciding value', {
            program: { $and: ['#.a', '#.b'] },
            cases: [
                { input: { a: 1, b: 'x' }, output: 'x' },
                { input: { a: 0, b: 'x' }, output: 0 },
                { input: { a: true, b: false }, output: false }
            ]
        });

        example('$or returns the first truthy value', {
            program: { $or: ['#.a', '#.b', 'default'] },
            cases: [
                { input: { a: null, b: 'b' }, output: 'b' },
                { input: {}, output: 'default' }
            ]
        });

        example('$and and $or over a computed array', {
            program: { all: { $and: '#' }, some: { $or: '#' }, none: { $and: [] }, nothing: { $or: [] } },
            input: [0, 1],
            output: { all: 0, some: 1, none: true, nothing: false }
        });

        it('$and and $or do not evaluate past the deciding value', () => {
            let calls = 0;
            const spy = { $spy: f => x => { calls += 1; return f(x); } };
            compile({ $and: [false, { $spy: true }] }, spy)(null);
            compile({ $or: [true, { $spy: true }] }, spy)(null);
            expect(calls).to.equal(0);
        });

        example('$if with and without else', {
            program: { yes: { $if: ['#', 'then', 'else'] }, maybe: { $if: ['#', 'then'] } },
            cases: [
                { input: true, output: { yes: 'then', maybe: 'then' } },
                { input: false, output: { yes: 'else', maybe: null } }
            ]
        });

        example('$cond picks the first matching clause', {
            program: {
                $cond: [
                    [{ $lt: ['#', 0] }, 'negative'],
                    [{ $eq: ['#', 0] }, 'zero'],
                    ['else', 'positive']
                ]
            },
            cases: [
                { input: -5, output: 'negative' },
                { input: 0, output: 'zero' },
                { input: 3, output: 'positive' }
            ]
        });

        example('$cond without a match is null', {
            program: { $cond: [[false, 1]] },
            input: null,
            output: null
        });

        example('$str concatenates, nulls become empty', {
            program: { $str: ['#.id', ' has no trait ', '#.trait', '#.missing'] },
            input: { id: 'order', trait: 'state' },
            output: 'order has no trait state'
        });

        example('$str of one value', {
            program: { $str: '#' },
            input: 42,
            output: '42'
        });

        example('$not', {
            program: { $not: '#' },
            input: 0,
            output: true
        });
    });

    describe('removed in version 2', () => {
        it('$conditional is an unknown function', () => {
            expect(() => compile({ $conditional: { if: '#', then: 'yes', else: 'no' } }))
                .to.throw(LambdaJSONError, "unknown function '$conditional'");
        });

        it('an underscored parameter is an unknown parameter with a hint', () => {
            expect(() => compile({ $map: { _fn: { $sum: ['#', 1] }, _over: '#' } }))
                .to.throw(LambdaJSONError, "write 'fn': parameters have no '_' prefix since version 2");
        });

        it('a custom function primitive receives an underscored object as plain data', () => {
            const $pick = f => x => f(x);
            expect(compile({ $pick: { _from: '#', _key: 'a' } }, { $pick })({ a: 1 })).to.deep.equal({ _from: { a: 1 }, _key: 'a' });
        });
    });

    describe('code and data are told apart by $', () => {
        const fails = (program, code, extra) => {
            try {
                compile(program, extra);
            } catch (error) {
                expect(error).to.be.instanceOf(LambdaJSONError);
                expect(error.code).to.equal(code);
                return error;
            }
            expect.fail(`expected ${code}`);
        };

        it('a $ key beside data keys is an error', () => {
            const error = fails({ a: { $sum: [1, 2], b: 1, c: 2 } }, 'mixed-call');
            expect(error.path).to.equal('/a');
        });

        it('two calls in one object are an error', () => fails({ $sum: [1], $head: [1] }, 'several-calls'));
        it('an unknown function is an error', () => fails({ $jion: ['a'] }, 'unknown-function'));
        it('$let without a body is an error', () => fails({ $let: { a: 1 } }, 'missing-body'));
        it('an unknown parameter is an error', () => fails({ $map: { fn: '#', ovr: '#' } }, 'unknown-parameter'));
        it('a missing parameter is an error', () => fails({ $map: { over: '#' } }, 'missing-parameter'));
        it('named arguments must be an object', () => fails({ $map: '#' }, 'named-arguments-expected'));
        it('as must be names', () => fails({ $map: { fn: '#', as: '@x' } }, 'invalid-as'));
        it('$if takes two or three items', () => fails({ $if: ['#'] }, 'invalid-arguments'));
        it('$cond takes pairs', () => fails({ $cond: [['#', 1, 2]] }, 'invalid-arguments'));
        it('a declared function may not shadow a primitive', () => fails({ $let: { $sum: '#' }, $sum: '#' }, 'shadowed-primitive'));

        it('the error path points into nested code', () => {
            const error = fails({ $map: { fn: { $str: [{ $nope: 1 }] } } }, 'unknown-function');
            expect(error.path).to.equal('/$map/fn/$str/0/$nope');
        });

        example('an escaped $ key keeps a plain object with several keys', {
            program: { '\\$sum': 1, b: '#', c: 2 },
            input: 'x',
            output: { $sum: 1, b: 'x', c: 2 }
        });

        example('functions declared in an enclosing $let are visible in nested code', {
            program: {
                $let: { $double: { $multiply: ['#', 2] } },
                $map: { fn: { $double: '#' } }
            },
            input: [1, 2],
            output: [2, 4]
        });
    });

    describe('lint', () => {
        it('reports needless escapes', () => {
            const problems = lint({ $str: ['\\ has no trait ', '\\#kept'] });
            expect(problems).to.deep.equal([
                { severity: 'warning', code: 'needless-escape', path: '/$str/0', message: "the string ' has no trait ' needs no escape" }
            ]);
        });

        it('reports needless key escapes', () => {
            const problems = lint({ '\\name': 1, '\\$kept': 2 });
            expect(problems.map(p => [p.code, p.path])).to.deep.equal([['needless-escape', '/\\name']]);
        });

        it('reports the structural error', () => {
            const [problem] = lint({ $sum: [1], extra: 1 });
            expect(problem).to.include({ severity: 'error', code: 'mixed-call', path: '' });
        });

        it('is quiet for a clean program', () => {
            expect(lint({ $map: { over: '#', as: 'x', fn: { $str: ['@x', '!'] } } })).to.deep.equal([]);
        });

        it('does not look inside $literal', () => {
            expect(lint({ $literal: { $nope: '\\x' } })).to.deep.equal([]);
        });
    });

    describe('named function parameters', () => {
        example('a $fn function binds its argument and keeps the caller input', {
            program: {
                $let: { $scale: { $fn: { as: 'v', body: { $multiply: ['@v', '#.factor'] } } } },
                $scale: '#.n'
            },
            input: { n: 4, factor: 3 },
            output: 12
        });

        example('several names bind the items of the argument', {
            program: {
                $let: { $add: { $fn: { as: ['a', 'b'], body: { $sum: ['@a', '@b', '#.c'] } } } },
                $add: ['#.a', '#.b']
            },
            input: { a: 1, b: 2, c: 10 },
            output: 13
        });

        it('a wrong argument count fails at run time', () => {
            const f = compile({ $let: { $f: { $fn: { as: ['a', 'b'], body: '@a' } } }, $f: [1] });
            expect(() => f(null)).to.throw(LambdaJSONRuntimeError);
        });

        it('a malformed $fn is an error', () => {
            expect(() => compile({ $let: { $f: { $fn: { as: 'a' } } }, $f: 1 })).to.throw(LambdaJSONError).with.property('code', 'invalid-function');
        });
    });

    describe('strict operands', () => {
        for (const op of ['$sum', '$subtract', '$multiply', '$divide', '$lt', '$lte', '$gt', '$gte']) {
            it(`${op} fails on a missing path`, () => {
                const f = compile({ [op]: [3, '#.missing'] });
                try {
                    f({});
                } catch (error) {
                    expect(error).to.be.instanceOf(LambdaJSONRuntimeError);
                    expect(error.code).to.equal('missing-operand');
                    expect(error.path).to.equal(`/${op}`);
                    return;
                }
                expect.fail('expected a failure');
            });
        }

        example('present operands compute as before', { program: { $multiply: [3, '#.a'] }, input: { a: 2 }, output: 6 });
        example('$eq may compare with a missing value', { program: { $eq: ['#.missing', null] }, input: {}, output: false });
    });

    describe('deep equality', () => {
        example('$eq compares objects and arrays by value', {
            program: { $eq: [{ a: [1, 2] }, '#'] },
            input: { a: [1, 2] },
            output: true
        });
        example('$neq is the negation', { program: { $neq: ['#.x', '#.y'] }, input: { x: { a: 1 }, y: { a: 1 } }, output: false });
    });

    describe('generic primitives', () => {
        example('$round', { program: [{ $round: { value: '#', digits: 2 } }, { $round: { value: '#' } }], input: 2.345, output: [2.35, 2] });
        example('$min and $max', { program: [{ $min: '#' }, { $max: '#' }], input: [3, 1, 2], output: [1, 3] });
        example('$count', { program: [{ $count: { collection: '#' } }, { $count: { predicate: { $gt: ['#', 1] } } }], input: [1, 2, 3], output: [3, 2] });
        example('$find', { program: { $find: { predicate: { $gt: ['@n', 1] }, as: 'n' } }, input: [1, 2, 3], output: 2 });
        example('$unique is deep', { program: { $unique: '#' }, input: [{ a: 1 }, { a: 1 }, 2, 2], output: [{ a: 1 }, 2] });
        example('$pick and $omit', {
            program: [{ $pick: { keys: ['a'] } }, { $omit: { keys: ['a'] } }],
            input: { a: 1, b: 2 },
            output: [{ a: 1 }, { b: 2 }]
        });
        example('$lower, $upper, $trim', { program: [{ $lower: '#' }, { $upper: '#' }, { $trim: '#' }], input: ' Ab ', output: [' ab ', ' AB ', 'Ab'] });
        example('$isNil', { program: [{ $isNil: '#.a' }, { $isNil: '#.b' }, { $isNil: '#.c' }], input: { b: null, c: 0 }, output: [true, true, false] });
    });

    describe('signatures', () => {
        it('primitives declare their types', () => {
            expect(signatureOf('$sum')).to.deep.equal({ takes: 'array<number>', returns: 'number' });
            expect(signatureOf('$map').takes).to.include({ fn: 'function' });
            expect(signatureOf('$filter').takes).to.include({ predicate: 'function', collection: 'array' });
            expect(signatureOf('$map').returns).to.equal('array');
        });
        it('a custom primitive without a signature has none', () => {
            expect(signatureOf('$mine', { $mine: f => f })).to.equal(undefined);
        });
    });

    describe('infer', () => {
        const order = {
            type: 'object',
            required: ['id', 'lines'],
            additionalProperties: false,
            properties: {
                id: { type: 'string' },
                qty: { type: 'number' },
                kind: { enum: ['a', 'b'] },
                lines: { type: 'array', items: { type: 'object', required: ['price'], additionalProperties: false, properties: { price: { type: 'number' } } } }
            }
        };
        const run = (program, options = {}) => infer(program, { input: order, ...options });
        const codes = r => r.problems.map(p => `${p.severity} ${p.code} ${p.path}`);

        it('walks paths through the input type', () => {
            expect(run('#.id').type).to.deep.equal({ type: 'string' });
            expect(run('#.qty').type).to.deep.equal({ anyOf: [{ type: 'number' }, { type: 'null' }] });
            expect(run('#.lines.0.price').problems).to.deep.equal([]);
        });

        it('reports an impossible path', () => {
            const r = run({ $return: '#.recrod.id' });
            expect(codes(r)).to.deep.equal(['error unknown-path /$return']);
            expect(r.type).to.deep.equal({});
        });

        it('an impossible path does not cascade into the expression that uses it', () => {
            expect(codes(run({ $gt: [1, '#.selff.min'] }))).to.deep.equal(['error unknown-path /$gt/1']);
            expect(codes(run({ $get: { path: 'lines.0.pricee' } }))).to.deep.equal(['error unknown-path /$get/path']);
        });

        it('types $get with an array path like the string path', () => {
            expect(run({ $get: { path: ['lines', 0, 'price'] } }).problems).to.deep.equal([]);
            expect(run({ $get: { object: '#', path: ['id'] } }).type).to.deep.equal({ type: 'string' });
            expect(codes(run({ $get: { path: ['lines', 0, 'pricee'] } }))).to.deep.equal(['error unknown-path /$get/path']);
            expect(run({ $get: { object: '#', path: ['$get', { $str: '#.id' }] } }).problems).to.deep.equal([]);
        });

        it('an unknown input never causes a problem', () => {
            const r = infer({ $multiply: ['#.a.b', 2] });
            expect(r.problems).to.deep.equal([]);
            expect(r.type).to.deep.equal({ type: 'number' });
        });

        it('warns about a possibly missing operand, errors on a wrong one', () => {
            expect(codes(run({ $multiply: ['#.qty', 2] }))).to.deep.equal(['warning possibly-missing-operand /$multiply/0']);
            expect(codes(run({ $sum: ['#.id', 1] }))).to.deep.equal(['error type-mismatch /$sum/0']);
        });

        it('binds lambda parameters', () => {
            const r = run({ $sum: { $map: { over: '#.lines', as: 'l', fn: '@l.price' } } });
            expect(r.problems).to.deep.equal([]);
            expect(r.type).to.deep.equal({ type: 'number' });
            expect(codes(run({ $map: { over: '#.lines', fn: '#.pirce' } }))).to.deep.equal(['error unknown-path /$map/fn']);
        });

        it('infers a fold in two passes', () => {
            const r = run({ $fold: { collection: '#.lines', as: ['t', 'i'], init: 0, with: { $sum: ['@t', '@i.price'] } } });
            expect(r.type).to.deep.equal({ type: 'number' });
        });

        it('reports unbound variables and mismatched collections', () => {
            expect(codes(run('@x'))).to.deep.equal(['error unknown-variable ']);
            expect(codes(run({ $map: { over: '#.id', fn: '#' } }))).to.deep.equal(['error type-mismatch /$map/over']);
        });

        it('warns about impossible comparisons', () => {
            expect(codes(run({ $eq: ['#.kind', 'c'] }))).to.deep.equal(['warning impossible-comparison /$eq']);
            expect(codes(run({ $eq: ['#.kind', 'a'] }))).to.deep.equal([]);
        });

        it('infers functions at each call site', () => {
            const program = {
                $let: { $pair: { $fn: { as: ['a', 'b'], body: { $sum: ['@a', '@b'] } } } },
                $pair: [1, 2]
            };
            expect(run(program).type).to.deep.equal({ type: 'number' });
            const wrong = { $let: program.$let, $pair: [1] };
            expect(codes(run(wrong))).to.deep.equal(['error wrong-argument-count /$pair']);
        });

        it('a recursive function has type any', () => {
            const r = infer({ $let: { $f: { $if: [{ $lte: ['#', 1] }, 1, { $multiply: ['#', { $f: { $subtract: ['#', 1] } }] }] } }, $f: 5 });
            expect(r.problems).to.deep.equal([]);
        });

        it('computes result types of primitives', () => {
            expect(run({ $head: '#.lines' }).type.anyOf).to.have.length(2);
            expect(run({ $keys: '#' }).type).to.deep.equal({ type: 'array', items: { type: 'string', enum: ['id', 'qty', 'kind', 'lines'] } });
            expect(run({ $pick: { keys: ['id'], object: '#' } }).type).to.deep.include({ required: ['id'], additionalProperties: false });
            expect(run({ $cond: [[{ $eq: ['#.id', 'x'] }, 1], ['else', 2]] }).type).to.deep.equal({ anyOf: [{ type: 'number', const: 1 }, { type: 'number', const: 2 }] });
            expect(run({ $get: { path: 'lines.0.pirce' } }).problems.map(p => p.code)).to.deep.equal(['unknown-path']);
        });

        it('uses the signature of a custom primitive', () => {
            const primitives = { $twice: typed(f => x => f(x) * 2, { takes: 'number', returns: 'number' }) };
            expect(infer({ $twice: 3 }, { primitives }).type).to.deep.equal({ type: 'number' });
            expect(infer({ $twice: 'a' }, { primitives }).problems.map(p => p.code)).to.deep.equal(['type-mismatch']);
            const dynamic = { $same: typed(f => f, { takes: 'any' }, argument => argument) };
            expect(infer({ $same: '#.id' }, { input: order, primitives: dynamic }).type).to.deep.equal({ type: 'string' });
        });

        it('includes the problems of lint; a structural error leaves the type open', () => {
            expect(infer({ $str: ['\\ x'] }).problems.map(p => p.code)).to.deep.equal(['needless-escape']);
            const r = infer({ $jion: [] });
            expect(r.type).to.deep.equal({});
            expect(r.problems.map(p => p.code)).to.deep.equal(['unknown-function']);
        });

        describe('deviations fixed in 3.1.1', () => {
            it('an impossible segment in some members of a union yields null', () => {
                const input = { type: 'object', required: ['a'], properties: { a: { anyOf: [{ type: 'string' }, { type: 'object', required: ['b'], additionalProperties: false, properties: { b: { type: 'number' } } }] } } };
                const r = infer({ $sum: [1, '#.a.b'] }, { input });
                expect(infer('#.a.b', { input }).type).to.deep.equal({ anyOf: [{ type: 'number' }, { type: 'null' }] });
                expect(r.problems.map(p => `${p.code} ${p.path}`)).to.deep.equal(['possibly-missing-operand /$sum/1']);
            });

            it('a primitive without a signature binds the names of as to any value', () => {
                const primitives = { $each: named(['fn', 'over=#', 'as?'], ({ fn, over }) => x => over(x).map(v => fn(x, v))) };
                const r = infer({ $each: { over: '#', as: 'v', fn: '@v' } }, { primitives });
                expect(r.problems).to.deep.equal([]);
            });

            it('$get, $keys and $values accept arrays', () => {
                const input = { type: 'array', items: { type: 'number' } };
                expect(infer({ $get: { object: '#', path: '0' } }, { input }).problems).to.deep.equal([]);
                expect(infer({ $keys: '#' }, { input }).problems).to.deep.equal([]);
                expect(infer({ $values: '#' }, { input }).type).to.deep.equal({ type: 'array', items: { type: 'number' } });
            });

            it('$merge with an unknown operand is open and forgets earlier properties', () => {
                const closed = { type: 'object', required: ['x'], additionalProperties: false, properties: { x: { type: 'number' } } };
                const input = { type: 'object', required: ['a'], properties: { a: closed } };
                const { type } = infer({ $merge: ['#.a', '#.b', { y: 'z' }] }, { input });
                expect(type.additionalProperties).to.equal(undefined);
                expect(type.properties.x).to.deep.equal({});
                expect(type.properties.y).to.deep.equal({ type: 'string', const: 'z' });
                expect(type.required).to.have.members(['x', 'y']);
            });
        });

        describe('object arguments', () => {
            const take = { type: 'object', properties: { entityType: { type: 'string' }, entityOperation: { type: 'string', enum: ['update', 'delete'] } }, required: ['entityType'], additionalProperties: false };
            const primitives = { $f: typed(a => a, { takes: take, returns: { type: 'boolean' } }) };
            const problems = (code, input = {}, takes) => infer(code, { input, primitives: takes ? { $f: typed(a => a, { takes }) } : primitives }).problems.map(p => `${p.code} ${p.path}: ${p.message}`);

            it('accepts a valid object', () => {
                expect(problems({ $f: { entityType: 'x', entityOperation: 'update' } })).to.deep.equal([]);
            });
            it('reports a property of the wrong type with its path', () => {
                expect(problems({ $f: { entityType: 5, entityOperation: 'update' } })).to.deep.equal(['type-mismatch /$f/entityType: the argument.entityType is 5, expected string']);
            });
            it('reports a literal outside the enum', () => {
                expect(problems({ $f: { entityType: 'x', entityOperation: 'updat' } })).to.have.length(1);
                expect(problems({ $f: { entityType: 'x', entityOperation: 'updat' } })[0]).to.contain('argument.entityOperation');
            });
            it('reports an extra key of a closed object', () => {
                expect(problems({ $f: { entityType: 'x', extra: 1 } })[0]).to.match(/^unknown-property \/\$f\/extra/);
            });
            it('reports a missing required key', () => {
                expect(problems({ $f: { entityOperation: 'update' } })[0]).to.match(/^missing-property/);
            });
            it('reports a whole value of the wrong kind', () => {
                expect(problems({ $f: 'text' })).to.have.length(1);
            });
            it('checks nested objects', () => {
                const takes = { type: 'object', properties: { a: take } };
                expect(problems({ $f: { a: { entityType: 1 } } }, {}, takes)[0]).to.contain('the argument.a.entityType is 1');
            });
            it('does not report a union property that overlaps', () => {
                const takes = { type: 'object', properties: { a: { type: ['string', 'number'] } } };
                expect(problems({ $f: { a: 1 } }, {}, takes)).to.deep.equal([]);
            });
            it('does not report an any property', () => {
                const takes = { type: 'object', properties: { a: {} } };
                expect(problems({ $f: { a: 1 } }, {}, takes)).to.deep.equal([]);
            });
            it('reports keys only for an exact argument type', () => {
                const partial = { type: 'object', properties: { entityOperation: { type: 'string' } } };
                expect(problems({ $f: '#' }, partial)).to.deep.equal([]);
                const wrong = { type: 'object', required: ['entityType'], properties: { entityType: { type: 'number' } } };
                expect(problems({ $f: '#' }, wrong)).to.have.length(1);
            });
            it('checks the items of an array literal', () => {
                const takes = { type: 'object', properties: { list: { type: 'array', items: { type: 'string' } } } };
                expect(problems({ $f: { list: ['a', 1] } }, {}, takes)[0]).to.contain('the argument.list[1] is 1');
                expect(problems({ $f: { list: ['a', 'b'] } }, {}, takes)).to.deep.equal([]);
            });
        });

        it('takes the types of outer variables', () => {
            expect(infer('@limit', { vars: { limit: { type: 'number' } } }).type).to.deep.equal({ type: 'number' });
        });
    });

    describe('$capture', () => {
        const run = (program, input) => compile(program)(input);
        const capture = (bindings, body) => ({ $capture: { values: bindings, in: body } });

        it('returns the program with the names of values bound', () => {
            expect(run(capture({ t: '#.name' }, { $eq: ['#.command', '@t'] }), { name: 'issue' }))
                .to.deep.equal({ $let: { t: 'issue' }, $in: { $eq: ['#.command', '@t'] } });
        });
        it('without values binds nothing', () => {
            expect(run({ $capture: { in: '#.a' } }, {})).to.deep.equal({ $let: {}, $in: '#.a' });
        });
        it('gives a program that runs later on another input', () => {
            const built = run(capture({ field: '#.field' }, { $str: ['#.value', '-', '@field'] }), { field: 'x' });
            expect(compile(built)({ value: 'v' })).to.equal('v-x');
        });
        it('reads a path of a bound name when it runs', () => {
            const built = run(capture({ target: { id: '#.id' } }, '@target.id'), { id: 7 });
            expect(compile(built)({})).to.equal(7);
        });
        it('keeps the parameters of a lambda in the program, and lets them shadow a bound name', () => {
            const built = run(capture({ t: '#.t' }, { $any: { collection: '#.commands', as: 'command', predicate: { $eq: ['@command', '@t'] } } }), { t: 'issue' });
            expect(compile(built)({ commands: ['a', 'issue'] })).to.equal(true);
            const shadowed = run(capture({ t: 1 }, { $map: { over: '#', as: 't', fn: '@t' } }), {});
            expect(compile(shadowed)([5, 6])).to.deep.equal([5, 6]);
        });
        it('nests: a name of the outer quote reaches the inner one only through its values', () => {
            const built = run(capture({ a: '#.a' }, capture({ b: '@a' }, '@b')), { a: 1 });
            const inner = compile(built)({});
            expect(inner).to.deep.equal({ $let: { b: 1 }, $in: '@b' });
            expect(compile(inner)({})).to.equal(1);
        });
        it('binds a computed value as data, never as an expression', () => {
            const built = run(capture({ a: '#.text' }, '@a'), { text: '#.secret' });
            expect(built.$let).to.deep.equal({ a: '\\#.secret' });
            expect(compile(built)({ secret: 'no' })).to.equal('#.secret');
            const keyed = run(capture({ a: '#.value' }, '@a'), { value: { $sum: [1, 2], '@k': '@x' } });
            expect(compile(keyed)({})).to.deep.equal({ '$sum': [1, 2], '@k': '@x' });
        });
        it('rejects a wrong argument', () => {
            for (const argument of [[], { values: {} }, { in: 1, other: 2 }, { values: 3, in: 1 }, { values: { $f: 1 }, in: 1 }]) {
                expect(() => compile({ $capture: argument })).to.throw(LambdaJSONError, /\$capture/);
            }
            expect(lint({ $capture: { values: {} } })[0]).to.include({ code: 'invalid-arguments', path: '/$capture' });
        });
        it('has a signature', () => {
            expect(signatureOf('$capture')).to.deep.equal({ takes: { values: 'object', in: 'any' }, returns: 'object' });
        });
        it('infers values as usual and types the result as the program', () => {
            const input = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'], additionalProperties: false };
            const { type, problems } = infer(capture({ t: '#.name' }, '@t'), { input });
            expect(problems).to.deep.equal([]);
            expect(type.properties.$in).to.deep.equal({ type: 'string', const: '@t' });
            expect(type.properties.$let.properties.t).to.deep.equal({ type: 'string' });
            expect(infer(capture({ t: '#.nope' }, '@t'), { input }).problems[0]).to.include({ code: 'unknown-path', path: '/$capture/values/t' });
        });
    });

    describe('$template', () => {
        const run = (program, input) => compile(program)(input);
        const template = (withs, mapping) => ({ $template: { with: withs, mapping } });

        it('fills a name and leaves #, @ and $ untouched', () => {
            expect(run(template({ t: '#.name' }, { $eq: ['#.command', '@t'] }), { name: 'issue' }))
                .to.deep.equal({ $eq: ['#.command', 'issue'] });
        });
        it('without with returns the mapping unchanged', () => {
            expect(run({ $template: { mapping: { $eq: ['#.a', '@b'] } } }, {})).to.deep.equal({ $eq: ['#.a', '@b'] });
        });
        it('takes a path of a bound name and leaves unbound names alone', () => {
            expect(run(template({ target: { id: '#.id' } }, ['@target.id', '@other.id', '@target']), { id: 7 }))
                .to.deep.equal([7, '@other.id', { id: 7 }]);
        });
        it('fills a name used as an object key', () => {
            expect(run(template({ role: '#.role' }, { '@role': '#.businessKey' }), { role: 'contract' }))
                .to.deep.equal({ contract: '#.businessKey' });
        });
        it('does not substitute inside longer strings', () => {
            expect(run(template({ a: '#.a' }, 'hello @a'), { a: 'x' })).to.equal('hello @a');
        });
        it('escapes a value that looks like an expression', () => {
            expect(run(template({ a: '#.text' }, { first: '@a' }), { text: '#.secret' })).to.deep.equal({ first: '\\#.secret' });
            expect(run(template({ a: '#.list' }, '@a'), { list: ['@x', { k: '\\y', '$z': '#w' }] }))
                .to.deep.equal(['\\@x', { k: '\\\\y', '\\$z': '\\#w' }]);
        });
        it('escapes a key that would be read as a call', () => {
            expect(run(template({ k: '#.k' }, { '@k': 1 }), { k: '$sum' })).to.deep.equal({ '\\$sum': 1 });
        });
        it('does not escape inside the argument of $literal', () => {
            expect(run(template({ a: '#.a' }, { $literal: { x: '@a' } }), { a: '#p' })).to.deep.equal({ $literal: { x: '#p' } });
        });
        it('substitutes the names of an outer template inside an inner one', () => {
            expect(run(template({ a: '#.a' }, template({ b: '#.b' }, ['@a', '@b'])), { a: 1 }))
                .to.deep.equal({ $template: { with: { b: '#.b' }, mapping: [1, '@b'] } });
        });
        it('binds own properties only', () => {
            expect(run(template({}, ['@toString', '@constructor']), {})).to.deep.equal(['@toString', '@constructor']);
        });
        it('gives a mapping that runs later on another input', () => {
            const built = run(template({ field: '#.field' }, { $str: ['#.value', '-', '@field'] }), { field: 'x' });
            expect(compile(built)({ value: 'v' })).to.equal('v-x');
        });
        it('builds the mapping of a lambda and keeps its parameters', () => {
            const built = run(template({ t: '#.t' }, { $any: { collection: '#.commands', as: 'command', predicate: { $eq: ['@command', '@t'] } } }), { t: 'issue' });
            expect(compile(built)({ commands: ['a', 'issue'] })).to.equal(true);
        });
        it('returns a fresh copy on every call, also for the parts without a hole', () => {
            const f = compile(template({ a: '#.a' }, { fixed: { deep: [1] }, hole: '@a' }));
            const first = f({ a: 1 });
            first.fixed.deep.push(2);
            expect(f({ a: 1 })).to.deep.equal({ fixed: { deep: [1] }, hole: 1 });
            const none = compile({ $template: { mapping: { x: [1] } } });
            none().x.push(2);
            expect(none()).to.deep.equal({ x: [1] });
        });
        it('fails for a key that is not a name', () => {
            expect(() => run(template({ k: '#.k' }, { '@k': 1 }), { k: { a: 1 } })).to.throw(LambdaJSONRuntimeError, 'object key');
        });
        it('rejects a wrong argument', () => {
            for (const argument of [[], { with: {} }, { mapping: 1, other: 2 }, { with: 3, mapping: 1 }]) {
                expect(() => compile({ $template: argument })).to.throw(LambdaJSONError, /\$template/);
            }
            expect(lint({ $template: { with: {} } })[0]).to.include({ code: 'invalid-arguments', path: '/$template' });
        });
        it('has a signature', () => {
            expect(signatureOf('$template')).to.deep.equal({ takes: { with: 'object', mapping: 'any' }, returns: 'any' });
        });

        describe('infer', () => {
            it('types the filled mapping as a literal', () => {
                const { type, problems } = infer(template({ t: '#.name' }, { $eq: ['#.command', '@t'] }), { input: { type: 'object', properties: { name: { type: 'string' } } } });
                expect(problems).to.deep.equal([]);
                const [command, name] = type.properties.$eq.prefixItems;
                expect(command).to.deep.equal({ type: 'string', const: '#.command' });
                expect(name).to.deep.equal(infer('#.name', { input: { type: 'object', properties: { name: { type: 'string' } } } }).type);
            });
            it('reports a wrong path in a bound expression', () => {
                const { problems } = infer(template({ t: '#.nope' }, '@t'), { input: { type: 'object', properties: {}, additionalProperties: false } });
                expect(problems[0]).to.include({ code: 'unknown-path', path: '/$template/with/t' });
            });
            it('reports a wrong path into a bound name', () => {
                const { problems } = infer(template({ t: { a: 1 } }, '@t.b'), {});
                expect(problems[0]).to.include({ code: 'unknown-path', path: '/$template/mapping' });
            });
            it('warns about a bound name the mapping never uses', () => {
                const { problems } = infer(template({ t: 1, u: 2 }, '@t'), {});
                expect(problems).to.have.length(1);
                expect(problems[0]).to.include({ severity: 'warning', code: 'unused-template-name', path: '/$template/with/u' });
            });
            it('does not warn about unbound names, and counts a key as a use', () => {
                expect(infer(template({ r: 'k' }, { '@r': '@param' }), {}).problems).to.deep.equal([]);
            });
            it('types a key by its constant value', () => {
                expect(infer(template({ r: 'role' }, { '@r': 1 }), {}).type.properties).to.have.property('role');
            });
        });
    });

    describe('$throw', () => {
        const thrown = (program, input) => { try { compile(program)(input); } catch (e) { return e; } return undefined; };
        const boom = { $throw: { code: 'invalid', message: { $str: ['no such role: ', '#.role'] }, data: { role: '#.role' } } };
        it('raises with the given code, message and data, without a path suffix', () => {
            const e = thrown(boom, { role: 'admin' });
            expect(e).to.be.instanceOf(LambdaJSONRuntimeError);
            expect(e).to.include({ code: 'invalid', message: 'no such role: admin', path: '/$throw' });
            expect(e.data).to.deep.equal({ role: 'admin' });
        });
        it('leaves data undefined when absent', () => {
            expect(thrown({ $throw: { code: 'c', message: 'm' } }).data).to.equal(undefined);
        });
        it('is lazy in $if', () => {
            expect(compile({ $if: ['#.ok', 1, boom] })({ ok: true })).to.equal(1);
            expect(compile({ $if: [false, boom, 1] })({})).to.equal(1);
            expect(thrown({ $if: [true, boom, 1] }, { role: 'r' })).to.have.property('code', 'invalid');
        });
        it('is lazy in $cond', () => {
            const program = { $cond: [['#.ok', 1], ['else', boom]] };
            expect(compile(program)({ ok: true })).to.equal(1);
            expect(thrown(program, { ok: false, role: 'r' })).to.have.property('code', 'invalid');
        });
        it('raises on the first item that reaches it inside $map', () => {
            const program = { $map: { fn: { $if: [{ $lt: ['#', 3] }, '#', { $throw: { code: 'big', message: { $str: ['too big: ', '#'] } } }] } } };
            expect(thrown(program, [1, 2, 3, 4]).message).to.equal('too big: 3');
        });
        it('works in a $let binding, when it is read', () => {
            expect(thrown({ $let: { a: { $throw: { code: 'c', message: 'm' } } }, $sum: ['@a', 1] })).to.have.property('code', 'c');
        });
        it('infers never, which does not widen siblings', () => {
            const input = { type: 'object', properties: { value: { type: 'number' }, t: { type: 'boolean' } }, required: ['value', 't'] };
            expect(infer(boom, { input: { type: 'object', properties: { role: { type: 'string' } } } }).type).to.deep.equal({ enum: [] });
            expect(infer({ $if: ['#.t', { $throw: { code: 'c', message: 'm' } }, '#.value'] }, { input }).type).to.deep.equal({ type: 'number' });
            const cond = infer({ $cond: [['#.t', '#.value'], ['else', { $throw: { code: 'c', message: 'm' } }]] }, { input });
            expect(cond.type).to.deep.equal({ type: 'number' });
        });
        it('reports a non-string code or message', () => {
            expect(lint({ $throw: { code: 1, message: 'm' } })[0]).to.include({ severity: 'error', path: '/$throw/code' });
            expect(lint({ $throw: { code: 'c', message: true } })[0]).to.include({ severity: 'error', path: '/$throw/message' });
            const { problems } = infer({ $throw: { code: 'c', message: '#.n' } }, { input: { type: 'object', properties: { n: { type: 'number' } } } });
            expect(problems[0]).to.include({ code: 'type-mismatch', path: '/$throw/message' });
        });
        it('lint accepts it as an expression and rejects an unknown argument', () => {
            expect(lint({ $if: [true, { $throw: { code: 'c', message: 'm' } }, 1] })).to.deep.equal([]);
            expect(lint({ $throw: { code: 'c', message: 'm', extra: 1 } })[0]).to.include({ severity: 'error', path: '/$throw/extra' });
            expect(lint({ $throw: { code: 'c' } })[0]).to.include({ severity: 'error' });
        });
    });

    describe('lazy $let bindings', () => {
        const boom = { $throw: { code: 'c', message: 'm' } };
        const spy = counter => ({ $count: f => x => { counter.calls += 1; return f(x); } });
        const thrown = (program, input, prims) => { try { compile(program, prims)(input); } catch (e) { return e; } return undefined; };
        it('does not evaluate a binding that is never read', () => {
            expect(compile({ $let: { a: boom, b: 1 }, $sum: ['@b', 1] })(null)).to.equal(2);
        });
        it('raises when a taken branch reads it, not an untaken one', () => {
            const program = ok => ({ $let: { a: boom }, $if: [ok, '@a', 1] });
            expect(thrown(program(true))).to.have.property('code', 'c');
            expect(compile(program(false))(null)).to.equal(1);
        });
        it('evaluates once, however often and wherever it is read', () => {
            const counter = { calls: 0 };
            const program = { $let: { a: { $count: 5 } }, $sum: ['@a', { $sum: { $map: { fn: '@a' } } }] };
            expect(compile(program, spy(counter))([1, 2, 3])).to.equal(20);
            expect(counter.calls).to.equal(1);
        });
        it('evaluates an earlier lazy binding once, when a later one is read', () => {
            const counter = { calls: 0 };
            const program = { $let: { a: { $count: 2 }, b: { $sum: ['@a', 1] } }, $sum: ['@b', '@b'] };
            expect(compile(program, spy(counter))(null)).to.equal(6);
            expect(counter.calls).to.equal(1);
            counter.calls = 0;
            compile({ $let: { a: { $count: 2 }, b: { $sum: ['@a', 1] } }, $sum: [1, 1] }, spy(counter))(null);
            expect(counter.calls).to.equal(0);
        });
        it('raises the same error on every read, without evaluating again', () => {
            const counter = { calls: 0 };
            const twice = { $let: { a: { $count: boom } }, $if: [false, 0, ['@a', '@a']] }; // the first read raises, so the counter stays at one
            const e = thrown(twice, null, spy(counter));
            expect(e).to.have.property('code', 'c');
            expect(counter.calls).to.equal(1);
            expect(compile({ $let: { a: boom }, $map: { fn: { $if: ['#', '@a', 0] } } })([0, 0])).to.deep.equal([0, 0]);
        });
        it('keeps a binding that reads a later one an unknown-variable in infer', () => {
            const { problems } = infer({ $let: { a: '@b', b: 1 }, $sum: [1, 1] });
            expect(problems.map(p => p.code)).to.include('unknown-variable');
        });
        it('infer still types and checks a binding that is never read', () => {
            const { problems } = infer({ $let: { a: { $sum: 'x' } }, $sum: [1, 1] });
            expect(problems.length).to.be.greaterThan(0);
        });
        it('leaves functions and as parameters unchanged', () => {
            expect(compile({ $let: { $double: { $multiply: ['#', 2] }, k: 3 }, $double: '@k' })(null)).to.equal(6);
            expect(compile({ $map: { as: 'n', fn: { $sum: ['@n', 1] } } })([1, 2])).to.deep.equal([2, 3]);
        });
    });

    describe('list typing (3.8.0)', () => {
        const T = { type: 'object', properties: { k: { enum: ['a', 'b'] } }, required: ['k'], additionalProperties: false };
        const list = { type: 'array', items: T };
        const idiom = { $concat: [[], '#'] };
        const typeOf = (program, input) => infer(program, { input });
        const ok = (program, input, type) => {
            const r = typeOf(program, input);
            expect(r.problems).to.deep.equal([]);
            expect(r.type).to.deep.equal(type);
        };
        it('$concat [[], x] keeps the item type for one value, a list, or either', () => {
            ok(idiom, T, list);
            ok(idiom, list, list);
            ok(idiom, { anyOf: [T, list] }, list);
        });
        it('an item field keeps its enum after $map over the result', () => {
            ok({ $map: { over: idiom, as: 'i', fn: '@i.k' } }, { anyOf: [T, list] }, { type: 'array', items: { enum: ['a', 'b'] } });
        });
        it('a nil member is appended as an item by $concat', () => {
            const r = typeOf(idiom, { anyOf: [T, { type: 'null' }] });
            expect(r.problems).to.deep.equal([]);
            expect(r.type.items.anyOf).to.have.length(2);
        });
        it('joins typed lists and a single value', () => {
            const input = { type: 'object', properties: { a: { type: 'array', items: { type: 'number' } }, b: { type: 'string' }, c: { type: 'array', items: { type: 'string' } } } , required: ['a', 'b', 'c'] };
            const expected = { type: 'array', items: { anyOf: [{ type: 'number' }, { type: 'string' }] } };
            ok({ $concat: ['#.a', '#.c'] }, input, expected);
            ok({ $concat: ['#.a', '#.b'] }, input, expected);
        });
        it('an any operand gives any items', () => {
            ok({ $concat: [[1], '#'] }, {}, { type: 'array', items: {} });
        });
        it('the flatten form types its items the same way', () => {
            ok({ $concat: '#' }, { type: 'array', items: { anyOf: [T, list] } }, list);
        });
        it('all operands empty stays array<any>', () => {
            ok({ $concat: [[], []] }, {}, { type: 'array', items: {} });
        });
        it('$concat runtime is unchanged', () => {
            const f = compile({ $concat: [[], '#'] });
            expect(f(1)).to.deep.equal([1]);
            expect(f([1, 2])).to.deep.equal([1, 2]);
            expect(f(null)).to.deep.equal([null]);
        });
        describe('$toList', () => {
            const f = compile({ $toList: '#' });
            it('runs for a value, a list, nil', () => {
                expect(f(1)).to.deep.equal([1]);
                expect(f([1, 2])).to.deep.equal([1, 2]);
                expect(f(null)).to.deep.equal([]);
                expect(f(undefined)).to.deep.equal([]);
            });
            it('types', () => {
                for (const input of [T, list, { anyOf: [T, list] }, { anyOf: [T, { type: 'null' }] }, { anyOf: [list, { type: 'null' }] }]) ok({ $toList: '#' }, input, list);
                ok({ $toList: null }, {}, { type: 'array', prefixItems: [], items: false });
            });
        });
    });

    describe('$map over an object (3.8.0)', () => {
        const program = { $map: { over: '#', as: ['v', 'k'], fn: { key: '@k', value: '@v' } } };
        it('runs', () => {
            expect(compile(program)({ a: 1, b: 'x' })).to.deep.equal([{ key: 'a', value: 1 }, { key: 'b', value: 'x' }]);
            expect(compile(program)([5])).to.deep.equal([{ key: 0, value: 5 }]);
        });
        it('types a record and a dictionary', () => {
            const record = { type: 'object', properties: { a: { type: 'number' }, b: { type: 'string' } }, required: ['a', 'b'], additionalProperties: false };
            let r = infer(program, { input: record });
            expect(r.problems).to.deep.equal([]);
            expect(r.type.items.properties.key).to.deep.equal({ type: 'string', enum: ['a', 'b'] });
            expect(r.type.items.properties.value.anyOf).to.have.length(2);
            r = infer(program, { input: { type: 'object', additionalProperties: { type: 'number' } } });
            expect(r.problems).to.deep.equal([]);
            expect(r.type.items.properties).to.deep.equal({ key: { type: 'string' }, value: { type: 'number' } });
        });
        it('keeps [item, index] for a list and rejects other types', () => {
            const r = infer(program, { input: { type: 'array', items: { type: 'boolean' } } });
            expect(r.type.items.properties).to.deep.equal({ key: { type: 'number' }, value: { type: 'boolean' } });
            expect(infer(program, { input: { type: 'number' } }).problems.map(p => p.code)).to.deep.equal(['type-mismatch']);
            expect(infer(program, { input: { type: 'string' } }).problems.map(p => p.code)).to.deep.equal(['type-mismatch']);
        });
    });

    describe('$isArray (3.8.0)', () => {
        it('tells lists from everything else', () => {
            const f = compile({ $isArray: '#' });
            expect([[], [1], {}, 1, 'a', null].map(v => f(v))).to.deep.equal([true, true, false, false, false, false]);
        });
        it('is boolean for any input type', () => {
            const r = infer({ $isArray: '#' }, { input: { anyOf: [{ type: 'string' }, { type: 'array' }] } });
            expect(r.type).to.deep.equal({ type: 'boolean' });
            expect(r.problems).to.deep.equal([]);
        });
    });

    describe('type tests and $startsWith (3.10.0)', () => {
        const values = [null, undefined, true, false, 0, 5, '', 'a', [], [1], {}, { a: 1 }];
        const answers = name => { const f = compile({ [name]: '#' }); return values.map(v => f(v)); };
        const only = idx => values.map((v, i) => idx.includes(i));
        it('$isString', () => expect(answers('$isString')).to.deep.equal(only([6, 7])));
        it('$isNumber', () => expect(answers('$isNumber')).to.deep.equal(only([4, 5])));
        it('$isBoolean', () => expect(answers('$isBoolean')).to.deep.equal(only([2, 3])));
        it('$isObject is false for arrays and null', () => expect(answers('$isObject')).to.deep.equal(only([10, 11])));
        describe('$startsWith', () => {
            const starts = (prefix, string) => compile({ $startsWith: { prefix, string: '#' } })(string);
            it('strings', () => {
                expect(starts('ab', 'abc')).to.equal(true);
                expect(starts('ab', 'xab')).to.equal(false);
                expect(starts('ab', 'ab')).to.equal(true);
                expect(starts('abc', 'ab')).to.equal(false);
                expect(starts('', 'x')).to.equal(true);
                expect(starts('', '')).to.equal(true);
            });
            it('the prefix is text, not a pattern', () => {
                expect(starts('.', 'a')).to.equal(false);
                expect(starts('^', '^a')).to.equal(true);
                expect(starts('[', '[a')).to.equal(true);
            });
            it('a value that is not a string is false', () => {
                for (const v of [5, null, undefined, {}, [], true]) expect(starts('', v)).to.equal(false);
            });
            it('missing path and default input', () => {
                expect(compile({ $startsWith: { prefix: 'a', string: '#.nope' } })({})).to.equal(false);
                expect(compile({ $startsWith: { prefix: 'a' } })('abc')).to.equal(true);
            });
        });
        describe('$endsWith', () => {
            const ends = (suffix, string) => compile({ $endsWith: { suffix, string: '#' } })(string);
            it('strings and text suffixes', () => {
                expect(ends('bc', 'abc')).to.equal(true);
                expect(ends('bc', 'bcx')).to.equal(false);
                expect(ends('abc', 'bc')).to.equal(false);
                expect(ends('', 'x')).to.equal(true);
                expect(ends('.', 'a')).to.equal(false);
                expect(ends('$', 'a$')).to.equal(true);
            });
            it('a value that is not a string is false; the input is the default', () => {
                for (const v of [5, null, undefined, {}, [], true]) expect(ends('', v)).to.equal(false);
                expect(compile({ $endsWith: { suffix: 'c' } })('abc')).to.equal(true);
            });
            it('suffix must be a string', () => {
                expect(infer({ $endsWith: { suffix: 5 } }, { input: { type: 'string' } }).problems.map(p => p.code)).to.deep.equal(['type-mismatch']);
            });
        });
        it('infer gives boolean', () => {
            for (const p of [{ $isNumber: '#' }, { $isString: '#' }, { $isBoolean: '#' }, { $isObject: '#' }, { $startsWith: { prefix: 'a' } }]) {
                const r = infer(p, { input: { type: 'string' } });
                expect(r.type).to.deep.equal({ type: 'boolean' });
                expect(r.problems).to.deep.equal([]);
            }
        });
        it('a prefix that is not a string is a type-mismatch', () => {
            expect(infer({ $startsWith: { prefix: 5 } }, { input: { type: 'string' } }).problems.map(p => p.code)).to.deep.equal(['type-mismatch']);
        });
        it('the names are reserved', () => {
            for (const name of ['$isString', '$isBoolean', '$isNumber', '$isObject', '$startsWith', '$endsWith']) {
                expect(() => compile({ $let: { [name]: '#' }, [name]: '#' })).to.throw().with.property('code', 'shadowed-primitive');
                expect(() => compileModule({ functions: { [name]: '#' } })).to.throw().with.property('code', 'reserved-function');
            }
        });
    });

    describe('reads (3.8.0)', () => {
        const reads = (program, options) => infer(program, options).reads;
        it('a path', () => {
            expect(reads('#.a.b.c')).to.deep.equal([['a', 'b', 'c']]);
            expect(reads('#')).to.deep.equal([[]]);
            expect(reads({ $sum: ['#0', '#.a[1]'] })).to.deep.equal([['0'], ['a', '1']]);
        });
        it('resolves a $let alias', () => {
            expect(reads({ $let: { c: '#.a.b' }, $in: '@c.d' })).to.deep.equal([['a', 'b', 'd']]);
            expect(reads({ $let: { c: '#.a', d: '@c.b' }, $in: '@d.e' })).to.deep.equal([['a', 'b', 'e']]);
        });
        it('reads a value used as a whole in full', () => {
            expect(reads({ $keys: '#.a' })).to.deep.equal([['a']]);
            expect(reads({ $keys: '#.entities' })).to.deep.equal([['entities']]);
            expect(reads({ $let: { c: '#.a' }, $keys: '@c' })).to.deep.equal([['a']]);
        });
        it('$get', () => {
            expect(reads({ $get: { object: '#.a', path: '#.k' } })).to.deep.equal([['a'], ['k']]);
            expect(reads({ $get: { object: '#.a', path: ['b', 'c'] } })).to.deep.equal([['a', 'b', 'c']]);
            expect(reads({ $get: { object: '#.a', path: 'b.c' } })).to.deep.equal([['a', 'b', 'c']]);
            expect(reads({ $get: { path: 'b' } })).to.deep.equal([['b']]);
            expect(reads({ $let: { c: '#.a' }, $get: { object: '@c', path: 'b' } })).to.deep.equal([['a', 'b']]);
        });
        it('counts every branch', () => {
            expect(reads({ $if: ['#.x', '#.a', '#.b'] })).to.deep.equal([['x'], ['a'], ['b']]);
            expect(reads({ $cond: [['#.x', '#.a'], ['else', '#.b']] })).to.deep.equal([['x'], ['a'], ['b']]);
        });
        it('an unread $let binding contributes nothing; a binding read twice contributes once', () => {
            expect(reads({ $let: { c: '#.a', d: { $keys: '#.z' } }, $in: '@c.x' })).to.deep.equal([['a', 'x']]);
            expect(reads({ $let: { d: { $keys: '#.z' } }, $str: ['@d', '@d'] })).to.deep.equal([['z']]);
        });
        it('a lambda reads the list in full and the parameter nothing more', () => {
            expect(reads({ $map: { over: '#.items', as: 'i', fn: '@i.price' } })).to.deep.equal([['items']]);
            expect(reads({ $map: { over: '#.items', fn: '#.price' } })).to.deep.equal([['items']]);
            expect(reads({ $map: { fn: '#.price' } })).to.deep.equal([[]]);
            expect(reads({ $map: { over: '#.items', as: 'i', fn: { $sum: ['@i.price', '#.tax'] } } })).to.deep.equal([['items'], ['tax']]);
        });
        it('a parameter shadows a variable of the same name', () => {
            expect(reads({ $let: { i: '#.a' }, $map: { over: '#.items', as: 'i', fn: '@i.price' } })).to.deep.equal([['items']]);
        });
        it('drops a path that has a prefix in the list', () => {
            expect(reads({ $sum: ['#.a.b', '#.a', '#.a.c', '#.a'] })).to.deep.equal([['a']]);
        });
        it('functions: arguments are read, the body sees its own input', () => {
            expect(reads({ $let: { $f: { $sum: ['#', 1] } }, $f: '#.n' })).to.deep.equal([['n']]);
            expect(reads({ $let: { $f: { $fn: { as: 'x', body: { $sum: ['@x', '#.k'] } } } }, $f: '#.n' })).to.deep.equal([['n'], ['k']]);
        });
        it('nothing read gives [], and a program that does not check still reports what it resolved', () => {
            expect(reads({ $sum: [1, 2] })).to.deep.equal([]);
            expect(reads({ $sum: ['#.a', 'x'] }, { input: { type: 'object', properties: { a: { type: 'number' } } } })).to.deep.equal([['a']]);
        });
        it('a template reads its bindings, not its mapping', () => {
            expect(reads({ $template: { with: { v: '#.a' }, mapping: { x: '@v', y: '#.b' } } })).to.deep.equal([['a']]);
        });
    });

    describe('modules (3.9.0)', () => {
        const pricing = { $net: f => x => f(x) / 1.2, $twice: f => x => f(x) * 2 };
        const dates = { $days: f => x => f(x) * 24, $twice: f => x => f(x) + f(x) };
        const code = (fn) => { try { fn(); } catch (e) { return e; } };
        const compiled = (program, modules, primitives = {}) => compile(program, primitives, { modules });

        describe('qualified calls', () => {
            it('calls a member of an injected module', () => {
                expect(compiled({ '$pricing/net': '#.gross' }, { pricing })({ gross: 120 })).to.equal(100);
            });
            it('fails with unknown-module for a module that is not injected', () => {
                const e = code(() => compiled({ $sum: [1, { '$nope/net': 1 }] }, { pricing }));
                expect(e).to.be.instanceOf(LambdaJSONError);
                expect(e.code).to.equal('unknown-module');
                expect(e.path).to.equal('/$sum/1/$nope~1net');
            });
            it('a member that the module does not have is an unknown-function', () => {
                expect(code(() => compiled({ '$pricing/nope': 1 }, { pricing })).code).to.equal('unknown-function');
            });
            it('a host primitive of the same qualified name has priority', () => {
                expect(compiled({ '$pricing/net': 120 }, { pricing }, { '$pricing/net': f => x => 'host' })(null)).to.equal('host');
            });
            it('rejects a module name that is not lowercase words joined by -', () => {
                for (const name of ['Pricing', 'a_b', 'a--b', '-a', 'a.b', '']) {
                    expect(code(() => compiled(1, { [name]: pricing })).code, name).to.equal('invalid-module-name');
                }
                expect(compiled({ '$versions-helper-set/net': 120 }, { 'versions-helper-set': pricing, '2': {} })(null)).to.equal(100);
            });
            it('lint reports it too', () => {
                expect(lint({ '$nope/x': 1 }).map(p => p.code)).to.deep.equal(['unknown-module']);
            });
        });

        describe('$include', () => {
            it('brings the members of one and of two modules into scope', () => {
                expect(compiled({ $include: ['pricing'], $in: { $net: 120 } }, { pricing })(null)).to.equal(100);
                expect(compiled({ $include: ['pricing', 'dates'], $in: { $sum: [{ $net: 120 }, { $days: 3 }] } }, { pricing, dates })(null)).to.equal(172);
            });
            it('qualified calls still work inside', () => {
                expect(compiled({ $include: ['pricing'], $in: { '$pricing/net': 120 } }, { pricing })(null)).to.equal(100);
            });
            it('the scope ends with $in', () => {
                const program = { $sum: [{ $include: ['pricing'], $in: { $net: 120 } }, { $net: 1 }] };
                const e = code(() => compiled(program, { pricing }));
                expect(e.code).to.equal('unknown-function');
                expect(e.path).to.equal('/$sum/1/$net');
            });
            it('an inner $include extends the outer one and shadows it', () => {
                const one = { $a: f => x => 'one-a', $b: f => x => 'one-b' };
                const two = { $a: f => x => 'two-a' };
                const program = { $include: ['one'], $in: [{ $a: 0 }, { $include: ['two'], $in: [{ $a: 0 }, { $b: 0 }] }] };
                expect(compiled(program, { one, two })(null)).to.deep.equal(['one-a', ['two-a', 'one-b']]);
            });
            it('sits beside $let, $include first', () => {
                const program = { $include: ['pricing'], $let: { gross: 120 }, $in: { $net: '@gross' } };
                expect(compiled(program, { pricing })(null)).to.equal(100);
                // a $let binding sees the included names
                expect(compiled({ $include: ['pricing'], $let: { net: { $net: 120 } }, $in: '@net' }, { pricing })(null)).to.equal(100);
            });
            it('a $let function shadows an included member, and an inner $include shadows a $let function', () => {
                const program = { $include: ['pricing'], $let: { $net: { $fn: { as: 'v', body: 'let' } } }, $in: { $net: 1 } };
                expect(compiled(program, { pricing })(null)).to.equal('let');
                const inverse = { $let: { $net: { $fn: { as: 'v', body: 'let' } } }, $in: { $include: ['pricing'], $in: { $net: 120 } } };
                expect(compiled(inverse, { pricing })(null)).to.equal(100);
            });
            it('is visible in lambda bodies and in $fn', () => {
                expect(compiled({ $include: ['pricing'], $in: { $map: { as: 'v', fn: { $twice: '@v' } } } }, { pricing })([1, 2])).to.deep.equal([2, 4]);
                const program = { $include: ['pricing'], $let: { $f: { $fn: { as: 'v', body: { $net: '@v' } } } }, $in: { $f: 120 } };
                expect(compiled(program, { pricing })(null)).to.equal(100);
            });
            it('is not carried by $capture or $template', () => {
                const capture = compiled({ $include: ['pricing'], $in: { $capture: { values: { a: 1 }, in: { $net: '@a' } } } }, { pricing })(null);
                expect(capture).to.deep.equal({ $let: { a: 1 }, $in: { $net: '@a' } });
                expect(code(() => compiled(capture, { pricing })).code).to.equal('unknown-function');
                expect(compiled({ $include: ['pricing'], $in: { $template: { with: { v: 1 }, mapping: { $net: '@v' } } } }, { pricing })(null)).to.deep.equal({ $net: 1 });
            });
            it('an unknown module is unknown-module at the $include', () => {
                const e = code(() => compiled({ $include: ['pricing', 'nope'], $in: 1 }, { pricing }));
                expect(e.code).to.equal('unknown-module');
                expect(e.path).to.equal('/$include');
            });
            it('takes a literal array of names', () => {
                expect(code(() => compiled({ $include: 'pricing', $in: 1 }, { pricing })).code).to.equal('invalid-include');
                expect(code(() => compiled({ $include: [1], $in: 1 }, { pricing })).code).to.equal('invalid-include');
                expect(code(() => compiled({ $include: ['pricing'] }, { pricing })).code).to.equal('missing-body');
            });
            it('an ambiguous name is an error only when called, qualified calls work', () => {
                const modules = { pricing, dates };
                expect(compiled({ $include: ['pricing', 'dates'], $in: { $net: 120 } }, modules)(null)).to.equal(100);
                const e = code(() => compiled({ $include: ['pricing', 'dates'], $in: { $twice: 2 } }, modules));
                expect(e.code).to.equal('ambiguous-function');
                expect(e.path).to.equal('/$in/$twice');
                expect(e.data).to.deep.equal({ modules: ['pricing', 'dates'] });
                expect(compiled({ $include: ['pricing', 'dates'], $in: ['$pricing/twice', '$dates/twice'].map(k => ({ [k]: 2 })) }, modules)(null)).to.deep.equal([4, 4]);
            });
            it('a member named like a primitive of the language is reserved', () => {
                for (const run of [() => compiled(1, { m: { $map: f => x => f(x) } }), () => infer(1, { modules: { m: { $if: f => x => f(x) } } })]) {
                    let e;
                    try { e = run(); } catch (error) { e = error; }
                    expect(e?.code ?? e?.problems?.[0]?.code).to.equal('reserved-function');
                }
            });
            it('infer and lint see the same names', () => {
                const typed_ = { $net: typed(pricing.$net, { takes: 'number', returns: 'number' }) };
                expect(infer({ $include: ['pricing'], $in: { $net: 120 } }, { modules: { pricing: typed_ } })).to.deep.include({ type: { type: 'number' }, problems: [] });
                expect(infer({ $include: ['pricing'], $in: { $net: 'x' } }, { modules: { pricing: typed_ } }).problems.map(p => p.code)).to.deep.equal(['type-mismatch']);
                expect(infer({ '$pricing/net': 1 }, { modules: { pricing: typed_ } }).type).to.deep.equal({ type: 'number' });
                expect(infer({ $include: ['pricing', 'dates'], $in: { $twice: 1 } }, { modules: { pricing, dates } }).problems.map(p => p.code)).to.deep.equal(['ambiguous-function']);
                expect(infer({ $let: { $f: { $fn: { as: 'v', body: { $include: ['pricing'], $in: { $net: '@v' } } } } }, $f: 1 }, { modules: { pricing: typed_ } }).type).to.deep.equal({ type: 'number' });
            });
            it('names used in a $fn body are those of the place where it is declared', () => {
                const typed_ = { $net: typed(pricing.$net, { takes: 'number', returns: 'number' }) };
                const program = { $include: ['pricing'], $let: { $f: { $fn: { as: 'v', body: { $net: '@v' } } } }, $in: { $f: 1 } };
                expect(infer(program, { modules: { pricing: typed_ } })).to.deep.include({ type: { type: 'number' }, problems: [] });
            });
        });

        describe('compileModule', () => {
            const source = {
                functions: {
                    $vat: { $multiply: ['#', 0.2] },
                    $gross: { $sum: ['#.net', { $vat: '#.net' }] },
                    $net: { $divide: ['#', 1.2] }
                },
                exports: ['$gross', '$net']
            };
            it('exports are reachable, private functions only from siblings', () => {
                const module = compileModule(source);
                expect(Object.keys(module)).to.deep.equal(['$gross', '$net']);
                expect(compile({ '$p/gross': { net: 100 } }, {}, { modules: { p: module } })(null)).to.equal(120);
                expect(code(() => compile({ '$p/vat': 1 }, {}, { modules: { p: module } })).code).to.equal('unknown-function');
            });
            it('without exports everything is exported', () => {
                expect(Object.keys(compileModule({ functions: source.functions }))).to.deep.equal(['$vat', '$gross', '$net']);
            });
            it('rejects bad sources', () => {
                expect(code(() => compileModule({ ...source, exports: ['$nope'] })).code).to.equal('unknown-export');
                expect(code(() => compileModule({ ...source, signatures: { $nope: {} } })).code).to.equal('unknown-signature');
                expect(code(() => compileModule({})).code).to.equal('invalid-module');
                expect(code(() => compileModule({ functions: { vat: 1 } })).code).to.equal('invalid-module');
                expect(code(() => compileModule({ functions: { '$a/b': 1 } })).code).to.equal('invalid-module');
                expect(code(() => compileModule({ functions: { $map: 1 } })).code).to.equal('reserved-function');
            });
            it('a function can call a sibling declared after it', () => {
                const module = compileModule({ functions: { $a: { $b: '#' }, $b: { $sum: ['#', 1] } } });
                expect(module.$a(x => x.input)({ input: 1, vars: {} })).to.equal(2);
            });
            it('mutual recursion does not loop the compiler', () => {
                const module = compileModule({ functions: {
                    $even: { $if: [{ $eq: ['#', 0] }, true, { $odd: { $subtract: ['#', 1] } }] },
                    $odd: { $if: [{ $eq: ['#', 0] }, false, { $even: { $subtract: ['#', 1] } }] }
                } });
                const run = n => compile({ '$m/even': '#' }, {}, { modules: { m: module } })(n);
                expect([0, 1, 4, 7].map(run)).to.deep.equal([true, false, true, false]);
            });
            it('a function body can use $include of injected modules, or qualified calls', () => {
                const module = compileModule({ functions: { $a: { $include: ['pricing'], $in: { $net: '#' } }, $b: { '$pricing/twice': '#' } } }, { modules: { pricing } });
                const run = (name, v) => compile({ [`$m/${name}`]: v }, {}, { modules: { m: module } })(null);
                expect(run('a', 120)).to.equal(100);
                expect(run('b', 3)).to.equal(6);
            });
            it('uses the host primitives', () => {
                const module = compileModule({ functions: { $a: { $host: '#' } } }, { primitives: { $host: f => x => `host ${f(x)}` } });
                expect(compile({ '$m/a': 1 }, {}, { modules: { m: module } })(null)).to.equal('host 1');
            });
            it('the names of the calling program are invisible inside the module', () => {
                const module = compileModule({ functions: { $a: '@x' } });
                const program = { $let: { x: 1 }, '$m/a': 2 };
                // `@x` is not bound in the module: the variable reads as undefined, not the caller's 1
                expect(compile(program, {}, { modules: { m: module } })(null)).to.equal(undefined);
                expect(code(() => compileModule({ functions: { $a: { $outer: 1 } } }, {})).code).to.equal('unknown-function');
                const caller = { $let: { $outer: { $fn: { as: 'v', body: 'caller' } } }, $in: { '$m/a': 1 } };
                const m2 = compileModule({ functions: { $a: { $outer: 1 } } }, { primitives: { $outer: f => x => 'host' } });
                expect(compile(caller, {}, { modules: { m: m2 } })(null)).to.equal('host');
            });
            it('errors in a function carry its path', () => {
                const e = code(() => compileModule({ functions: { $a: { $sum: [1, { $nope: 1 }] } } }));
                expect(e.path).to.equal('/functions/$a/$sum/1/$nope');
            });
            it('attaches a declared signature to the export', () => {
                const takes = { type: 'number' };
                const module = compileModule({ functions: { $a: '#' }, signatures: { $a: { takes, returns: takes } } });
                expect(signatureOf('$a', module)).to.deep.equal({ takes, returns: takes });
            });
        });

        describe('typeModule', () => {
            const number = { type: 'number' };
            const source = {
                functions: {
                    $vat: { $multiply: ['#', 0.2] },
                    $gross: { $sum: ['#.net', { $vat: '#.net' }] },
                    $label: { $str: ['gross ', '#'] },
                    $bad: { $str: '#' },
                    $net: { $divide: ['#', 1.2] }
                },
                exports: ['$gross', '$label', '$net'],
                signatures: {
                    $gross: { takes: { type: 'object', properties: { net: number }, required: ['net'] }, returns: number },
                    $net: { takes: number, returns: number }
                }
            };
            it('exports typed primitives, unsigned ones with the inferred result type', () => {
                const { module, problems } = typeModule(source);
                expect(problems).to.deep.equal([]);
                expect(Object.keys(module)).to.deep.equal(['$gross', '$label', '$net']);
                const result = program => infer(program, { modules: { m: module } });
                expect(result({ '$m/label': 1 })).to.deep.include({ type: { type: 'string' }, problems: [] });
                expect(result({ '$m/net': 1 }).type).to.deep.equal(number);
            });
            it('checks the argument of a call against takes', () => {
                const { module } = typeModule(source);
                expect(infer({ '$m/net': 'x' }, { modules: { m: module } }).problems.map(p => p.code)).to.deep.equal(['type-mismatch']);
                expect(infer({ '$m/gross': { net: 'x' } }, { modules: { m: module } }).problems.map(p => p.code)).to.deep.equal(['type-mismatch']);
            });
            it('reports a body whose result disagrees with returns', () => {
                const { problems } = typeModule({ functions: { $a: { $str: '#' } }, signatures: { $a: { takes: number, returns: number } } });
                expect(problems.map(p => [p.code, p.path])).to.deep.equal([['type-mismatch', '/functions/$a']]);
            });
            it('reports a path that takes does not have', () => {
                const { problems } = typeModule({ functions: { $a: '#.gross' }, signatures: { $a: { takes: { type: 'object', properties: { net: number }, additionalProperties: false }, returns: number } } });
                expect(problems.map(p => [p.code, p.path])).to.deep.equal([['unknown-path', '/functions/$a']]);
            });
            it('does not depend on the order of declaration, and a cycle is typed any', () => {
                const forward = typeModule({ functions: { $a: { $b: '#' }, $b: { $sum: ['#', 1] } } });
                const backward = typeModule({ functions: { $b: { $sum: ['#', 1] }, $a: { $b: '#' } } });
                expect(forward.module.$a.signature.returns).to.deep.equal({ type: 'number' });
                expect(backward.module.$a.signature.returns).to.deep.equal({ type: 'number' });
                const cycle = typeModule({ functions: { $a: { $b: '#' }, $b: { $a: '#' } } });
                expect(cycle.problems).to.deep.equal([]);
                expect(cycle.module.$a.signature.returns).to.deep.equal({});
            });
            it('uses the injected modules and the host primitives', () => {
                const inner = { $net: typed(pricing.$net, { takes: 'number', returns: 'number' }) };
                const { module, problems } = typeModule({ functions: { $a: { $include: ['pricing'], $in: { $net: '#' } } } }, { modules: { pricing: inner } });
                expect(problems).to.deep.equal([]);
                expect(module.$a.signature.returns).to.deep.equal({ type: 'number' });
                const host = typeModule({ functions: { $a: { $host: '#' } } }, { primitives: { $host: typed(f => x => f(x), { takes: 'any', returns: 'string' }) } });
                expect(host.module.$a.signature.returns).to.deep.equal({ type: 'string' });
            });
            it('reports a structural error of the source as a problem', () => {
                const { module, problems } = typeModule({ functions: {}, exports: ['$x'] });
                expect(module).to.deep.equal({});
                expect(problems.map(p => p.code)).to.deep.equal(['unknown-export']);
            });
            it('reports the problems of an unsigned function too', () => {
                const { problems } = typeModule({ functions: { $a: { $sum: ['x', 1] } } });
                expect(problems.map(p => p.path)).to.deep.equal(['/functions/$a/$sum/0']);
            });
        });

        it('programs without modules are unaffected', () => {
            expect(compile({ $sum: [1, 2] })(null)).to.equal(3);
            expect(code(() => compile({ '$func/x': 1 })).code).to.equal('unknown-module');
            expect(compile({ '$func/x': 1 }, { '$func/x': f => x => f(x) })(null)).to.equal(1);
        });
    });
});
