
import { expect } from 'chai';
import { parse } from '../src/parser.js'

function example(description, { program, cases, input, output }, only = false) {
    const q = only ? it.only : it;
    q (description, () => {
        const f = parse(program);
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
            $return: '$'
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
            name: '$.person.name',
            age: '$.age',
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
            $sum: '$'
        },
        input: [1, 2, 3],
        output: 1 + 2 + 3
    });

    example ('add constant to a number', {
        program: {
            $sum: [1, '$']
        },
        input: 1,
        output: 1 + 1
    });

    example ('apply function', {
        program: {
            $apply: {
                $fn: {
                    $sum: [1, '#']
                },
                $to: '$'
            }
        },
        input: 1,
        output: 1 + 1
    });

    example ('check equality', {
        program: {
            $eq: [ '$.a', '$.b' ]
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
                $if: {
                    $eq: '$',
                },
                $then: 1,
                $else: 0
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
                a: '$',
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
                        $if: { $lte: ['#', 2] },
                        $then: 1,
                        $else: {
                            $sum: [
                                {
                                   $apply: {
                                        $fn: '@$fib',
                                        $to: {
                                            $subtract: ['#', 1]
                                        }
                                    } 
                                },
                                {
                                    $apply: {
                                        $fn: '@$fib',
                                        $to: {
                                            $subtract: ['#', 2]
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            },
            $apply: {
                $fn: '@$fib',
                $to: '$'
            }
        },
        input: 6,
        output: 8
    });

    example ('map function over array', {
        program: {
            $map: {
                $fn: {
                    $sum: ['#', '#']
                },
                $over: '$'
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
            $apply: {
                $fn: '@$square',
                $to: '$'
            }
        },
        input: 3,
        output: 9
    });

    example ('filter array', {
        program: {
            $filter: {
                $predicate: {
                    $lte: ['#', 10]
                },
                $collection: '$'
            }
        },
        input: [1, 11, 2, 12, 3, 13],
        output: [1, 2, 3]
    });
});