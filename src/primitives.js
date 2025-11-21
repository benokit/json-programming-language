import { filter, map, multiply, sum } from 'lodash-es'

const input = ({ input }) => input

export const primitives = {
    $let: true,
    $return: (f) => {
        return x => f(x);
    },
    $apply: ({ $fn, $to = input }) => {
        return x => $fn({ ...x, input: $to(x)});
    },
    $conditional: ({ $if, $then, $else }) => {
        return x => $if(x) ? $then(x) : $else(x);
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
    $map: ({ $fn, $over = input }) => {
        return x => map($over(x), v => $fn({ ...x, input: v }));
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
    $filter: ({ $predicate, $collection = input }) => {
        return x => filter($collection(x), v => $predicate({ ...x, input: v }));
    }
}
