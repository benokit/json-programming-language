import { map, sum } from 'lodash-es'

export const primitives = {
    $let: true,
    $return: (f) => {
        return x => f(x);
    },
    $apply: ({ $fn, $to }) => {
        return x => $fn({ ...x, value: $to(x)});
    },
    $conditional: ({$if, $then, $else}) => {
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
        return x => {
            return !f(x);
        };
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
    $map: ({ $fn, $over }) => {
        return x => map($over(x), v => $fn({ ...x, value: v }));
    },
    $sum: (f) => {
        return x => sum(f(x));
    }
}
