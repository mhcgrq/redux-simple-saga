import { is, makeIterator } from '../utils';

export default function createTaskIterator(fnDesc: { context: any, fn: (...args: any[]) => any, args: any[] }) {
    const { context, fn, args } = fnDesc;
    if (is.iterator(fn)) {
        return fn;
    }

    // catch synchronous failures; see #152 and #441
    let result: any;
    let error: Error | undefined = undefined;
    try {
        result = fn.apply(context, args);
    } catch (err) {
        error = err;
    }

    // i.e. a generator function returns an iterator
    if (is.iterator(result)) {
        return result;
    }

    // do not bubble up synchronous failures for detached forks
    // instead create a failed task. See #152 and #441
    if (error) {
        return makeIterator(() => { throw error });
    }
    const next = (() => {
        let isDone = false;
        const eff = { done: false, value: result };
        const ret = (value: any) => ({ done: true, value });
        return (value: any) => {
            if (!isDone) {
                isDone = true;
                return eff;
            } else {
                return ret(value);
            }
        }
    })();
    return makeIterator(next);
}