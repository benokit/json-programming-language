import { printf } from 'fast-printf';
import { concat, divide, eq, filter, first, groupBy, gt, gte, join, keyBy, lt, lte, map, mapValues, multiply,
    reduce, split, subtract, sum, tail, take, takeWhile, values, zipWith } from 'lodash-es'

const input = ({ input }) => input

export const primitives = {
    $let: true,
    $: f => x => v => f({ ...x, input: v}),
    $in: f => x => f(x),
    $return: f => x => f(x),
    $apply: ({ _fn, _to = input }) => x => _fn({ ...x, input: _to(x)}),
    $pipeline: f => x => reduce(f(x), (a, g) => g(a), x.input),
    $conditional: ({ _if, _then, _else }) => x => _if(x) ? _then(x) : _else(x),
    $eq: f => x => eq(...f(x)),
    $neq: f => x => !eq(...f(x)),
    $negate: f => x => !f(x),
    $lt: f => x => lt(...f(x)),
    $lte: f => x => lte(...f(x)),
    $gt: f => x => gt(...f(x)),
    $gte: f => x => gte(...f(x)),
    $map: ({ _fn, _over = input }) => x => map(_over(x), v => _fn({ ...x, input: v })),
    $mapValues: ({ _fn, _of = input }) => x => mapValues(_of(x), v => _fn({ ...x, input: v })),
    $sum: f => x => sum(f(x)),
    $subtract: f => x => subtract(...f(x)),
    $multiply: f => x => multiply(...f(x)),
    $divide: f => x => divide(...f(x)),
    $filter: ({ _predicate, _collection = input }) => x => filter(_collection(x), v => _predicate({ ...x, input: v })),
    $head: f => x => first(f(x)),
    $tail: f => x => tail(f(x)),
    $concat: f => x => concat(...f(x)),
    $group: ({ _by, _collection = input }) => x => groupBy(_collection(x), v => _by({...x, input: v})),
    $toDictionary: ({ _by, _collection = input }) => x => keyBy(_collection(x), v => _by({...x, input: v})),
    $values: f => x => values(f(x)),
    $split: ({ _separator, _string = input }) => x => split(_string(x), _separator(x)),
    $match: ({ _pattern, _string = input }) => x => _string(x).match(_pattern(x)),
    $join: ({ _separator, _strings = input }) => x => join(_strings(x), _separator(x)),
    $printf: ({ _template, _args = input}) => x => printf(_template(x), ..._args(x)),
    $take: ({ _while, _count, _from = input }) => x => {
        let y = _from(x);
        y = _while ? takeWhile(y, v => _while({ ...x, input: v })) : y
        y = _count ? take(y, _count(x)) : y
        return y;
    },
    $zip: ({ _with, _sequences = input }) => {
        const combinator = _with ? (x, v) => _with({...x, input: v}) : (x, v) => v;
        return x => {
            const [as, bs] = _sequences(x);
            return zipWith(as, bs, (a, b) => combinator(x, [a, b]));
        }
    },
    $fold: ({ _with, _init, _collection = input })  => {
        const aggregator = (x, v) => _with({...x, input: v});
        return _init
            ? x => reduce(_collection(x), (a, v) => aggregator(x, [a, v]), _init(x))
            : x => reduce(_collection(x), (a, v) => aggregator(x, [a, v]));
    }
}
