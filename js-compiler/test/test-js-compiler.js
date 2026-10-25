
import { expect } from 'chai';
import { compile, lint, LambdaJSONError } from '../src/js-compiler.js'

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
});
