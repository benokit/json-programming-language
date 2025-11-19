
import { expect } from 'chai';
import { parse } from '../src/parser.js'

describe('pure json programming language', () => {
    it('constant function - object', () => {
        const program = {};
        const f = parse(program);
        expect(f()).to.deep.equal({});
    });

    it ('identity function', () => {
        const program = {
            $return: '$'
        };
        const f = parse(program);
        const input = {};
        expect(f(input)).to.equal(input);
    });

    it ('constant function - string', () => {
        const program = {
            $return: 'test'
        };
        const f = parse(program);
        expect(f()).to.equal('test');
    });

    it ('constant function - number ', () => {
        const program = {
            $return: 1.1
        };
        const f = parse(program);
        expect(f()).to.equal(1.1);
    });

    it ('map object to object', () => {
        const program = {
            name: '$.person.name',
            age: '$.age',
            const: 1
        };
        const f = parse(program);
        const input = {
            person: {
                name: 'Ben'
            },
            age: 21
        }
        const output = f(input);
        const expectedOutput = {
            name: 'Ben',
            age: 21,
            const: 1
        };
        expect(output).to.deep.equal(expectedOutput);
    });

    it ('sum numbers', () => {
        const program = {
            $sum: '$'
        };
        const f = parse(program);
        const input = [1, 2, 3];
        expect(f(input)).to.equal(1 + 2 + 3);
    });

    it ('add constant to a number', () => {
        const program = {
            $sum: [1, '$']
        };
        const f = parse(program);
        const input = 1;
        expect(f(input)).to.equal(1 + 1); 
    });

    it ('apply function', () => {
        const program = {
            $apply: {
                $fn: {
                    $sum: [1, '#']
                },
                $to: '$'
            }
        };
        const f = parse(program);
        const input = 1;
        expect(f(input)).to.equal(1 + 1); 
    });

    it ('check equality', () => {
        const program = {
            $eq: [ '$.a', '$.b' ]
        };
        const f = parse(program);
        expect(f({ a: 1, b: 2 })).to.equal(false);
        expect(f({ a: 1, b: 1 })).to.equal(true);
    });

    it ('conditional if-else', () => {
        const program = {
            $conditional: {
                $if: {
                    $eq: '$',
                },
                $then: 1,
                $else: 0
            }
        };
        const f = parse(program);
        expect(f([1, 2])).to.equal(0);
        expect(f([1, 1])).to.equal(1);
    });

    it ('declare variable', () => {
        const program = {
            $let: {
                a: '$',
                b: {
                    $sum: ['@a', '@a']
                }
            },
            $sum: [1, '@b']
        };
        const f = parse(program);
        expect(f(1)).to.equal(3);
    });

    it ('declare function (recursive)', () => {
        const program = {
            $let: {
                $f: {
                    $conditional: {
                        $if: { $eq: ['#', 3] },
                        $then: '#',
                        $else: {
                            $sum: [ '#',
                                {
                                    $apply: {
                                        $fn: '@$f',
                                        $to: {
                                            $sum: [1, '#']
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            },
            $apply: {
                $fn: '@$f',
                $to: '$'
            }
        };
        const f = parse(program);
        expect(f(1)).to.equal(6);
    });

    it ('map function over array', () => {
        const program = {
            $let: {
                a: 1,
                $f: {
                    $sum: ['@a', '#']
                }
            },
            $map: {
                $fn: {
                    $apply: {
                        $fn: '@$f',
                        $to: '#'
                    }
                },
                $over: '$'
            }
        };
        const f = parse(program);
        const input = [1, 2, 3];
        expect(f(input)).to.deep.equal([2, 3, 4]); 
    });
});