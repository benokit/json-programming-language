import { filter, first, identity, map, multiply, reduce, sum, tail, take, takeWhile, zipWith } from 'lodash-es'

const input = ({ input }) => input

export const primitives = {
    $let: true,
    $: (f) => {
        return x => v => f({ ...x, input: v})
    },
    $in: (f) => {
        return x => f(x);
    },
    $return: (f) => {
        return x => f(x);
    },
    $apply: ({ _fn, _to = input }) => {
        return x => _fn({ ...x, input: _to(x)});
    },
    $conditional: ({ _if, _then, _else }) => {
        return x => _if(x) ? _then(x) : _else(x);
    },
    $eq: (f) => {
        return x => {
            const [a, b] = f(x);
            return a === b;
        };
    },
    $neq: (f) => {
        return x => {
            const [a, b] = f(x);
            return a != b;
        };
    },
    $negate: (f) => {
        return x => !f(x);
    },
    $lt: (f) => {
        return x => {
            const [a, b] = f(x);
            return a < b;
        };
    },
    $lte: (f) => {
        return x => {
            const [a, b] = f(x);
            return a <= b;
        };
    },
    $gt: (f) => {
        return x => {
            const [a, b] = f(x);
            return a > b;
        };
    },
    $gte: (f) => {
        return x => {
            const [a, b] = f(x);
            return a >= b;
        };
    },
    $map: ({ _fn, _over = input }) => {
        return x => map(_over(x), v => _fn({ ...x, input: v }));
    },
    $sum: (f) => {
        return x => sum(f(x));
    },
    $subtract: (f) => {
        return x => {
            const [a, b] = f(x);
            return a - b;
        }
    },
    $multiply: (f) => {
        return x => multiply(...f(x));
    },
    $filter: ({ _predicate, _collection = input }) => {
        return x => filter(_collection(x), v => _predicate({ ...x, input: v }));
    },
    $head: (f) => {
        return x => first(f(x));
    },
    $tail: (f) => {
        return x => tail(f(x));
    },
    $take: ({ _while, _count, _from = input }) => {
        return x => {
            let y = _from(x);
            y = _while ? takeWhile(y, v => _while({ ...x, input: v })) : y
            y = _count ? take(y, _count(x)) : y
            return y;
        }
    },
    $zip: ({ _with, _sequences = input }) => {
        return x => {
            const combinator = _with ? v => _with({...x, input: v}) : identity;
            const [as, bs] = _sequences(x);
            return zipWith(as, bs, (a, b) => combinator([a, b]));
        }
    },
    $pipeline: ({ _sequence, _input = input }) => {
        return x => {
            return reduce(_sequence(x), (a, f) => f(a), _input(x));
        }
    }
}
