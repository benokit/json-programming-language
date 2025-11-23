
import { expect } from 'chai';
import { compile } from '../src/js-compiler.js'

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
                _fn: {
                    $sum: [1, '#']
                },
                _to: '#'
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
            $conditional: {
                _if: {
                    $eq: '#',
                },
                _then: 1,
                _else: 0
            }
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
                    $conditional: {
                        _if: { $lte: ['#', 2] },
                        _then: 1,
                        _else: {
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
                    }
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
                _fn: {
                    $sum: ['#', '#']
                },
                _over: '#'
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
                _predicate: {
                    $lte: ['#', 10]
                },
                _collection: '#'
            }
        },
        input: [1, 11, 2, 12, 3, 13],
        output: [1, 2, 3]
    });

    example ('take elements from an array', {
        program: {
            $take: {
                _while: {
                    $lte: ['#', 5]
                },
                _count: 5,
                _collection: '#'
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
                _sequences: ['#', '#']
            }
        },
        input: [1, 3, 2],
        output: [[1, 1], [3, 3], [2, 2]]
    }); 

    example ('zip with', {
        program: {
            $zip: {
                _with: { $multiply: ['#0', '#1'] },
                _sequences: ['#', '#']
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
                _with: {
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
                _with: {
                    $sum: ['#0', '#1']
                },
                _init: -6
            }
        },
        input: [1, 2, 3],
        output: 0
    });

    example ('group by', {
        program: {
            $group: {
                _by: '#.country'
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
                _by: '#.name'
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
                        _pattern: '^(\\d{4})-(\\d{2}-\\d{2})'
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
                _template: 'ABC-%04d/%d'
            }
        },
        input: [12, 2025],
        output: 'ABC-0012/2025'
    });

    example ('string join', {
        program: {
            $join: {
                _separator: '-'
            }
        },
        input: [2025, '01-01'],
        output: '2025-01-01'
    });
});