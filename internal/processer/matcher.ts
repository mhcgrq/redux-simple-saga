import { kTrue, is } from '../utils';
import { Pattern, Action, Predicate } from '../interface';

const matchers = {
    wildcard: () => kTrue,
    default: (pattern: string | symbol) => (input: Action) => input.type === (typeof pattern === 'symbol' ? pattern : String(pattern)),
    array: (patterns: Array<string | symbol>) => (input: Action) => patterns.some(p => matcher(p)(input)),
    predicate: (predicate: Predicate) => (input: Action) => predicate(input)
}

export default function matcher(pattern: string | symbol): Predicate {
    let mat: (pattern: Pattern) => Predicate;
    switch (true) {
        case pattern === '*':
            mat = matchers.wildcard;
            break;
        case is.array(pattern):
            mat = matchers.array;
            break;
        case is.stringableFunc(pattern):
            mat = matchers.default;
            break;
        case is.func(pattern):
            mat = matchers.predicate;
            break;
        default:
            mat = matchers.default;
    }
    return mat(pattern);
}
