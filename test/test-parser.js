
import { expect } from 'chai';
import { parse } from '../src/parser.js'

describe('pure json programming language', () => {
    it('should return a function that returns empty object if empty object', () => {
        const program = {};
        const f = parse(program);
        expect(f({})).to.deep.equal({});
    });

    it ('should return an identity function', () => {
        const program = {
            $return: '$'
        };
        const f = parse(program);
        const input = {};
        expect(f({input})).to.equal(input);
    });

    it ('should return a function that returns a constant string', () => {
        const program = {
            $return: 'test'
        };
        const f = parse(program);
        expect(f({})).to.equal('test');
    });

    it ('should return a function that returns a constant number', () => {
        const program = {
            $return: 1.1
        };
        const f = parse(program);
        expect(f({})).to.equal(1.1);
    });

    it ('should return a function that maps an object into another object', () => {
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
        const output = f({input});
        const expectedOutput = {
            name: 'Ben',
            age: 21,
            const: 1
        };
        expect(output).to.deep.equal(expectedOutput);
    });

    it ('should return a function that sums numbers', () => {
        const program = {
            $sum: '$'
        };
        const f = parse(program);
        const input = [1, 2, 3];
        expect(f({input})).to.equal(1 + 2 + 3);
    });

    it ('should return a function that adds 1 to a number', () => {
        const program = {
            $sum: [1, '$']
        };
        const f = parse(program);
        const input = 1;
        expect(f({input})).to.equal(1 + 1); 
    });

    it ('should return a function that applies a function', () => {
        const program = {
            $apply: {
                $fn: {
                    $sum: [1, '$']
                },
                $to: '$'
            }
        };
        const f = parse(program);
        const input = 1;
        expect(f({input})).to.equal(1 + 1); 
    });

    it ('should return a function that adds 2 to each number in an array', () => {
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
        expect(f({input})).to.deep.equal([2, 3, 4]); 
    });
});