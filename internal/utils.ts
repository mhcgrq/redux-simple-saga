import {
    CancelablePromise,
    Deferrable,
    SagaIterator,
} from './interface';
import { EffectDescriptor } from './io';

export const sym = (id: number | string) => `@@redux-saga/${id}`;
export const TASK = sym('TASK');
export const HELPER = sym('HELPER');
// export const MATCH = sym('MATCH');
export const CANCEL = sym('cancelPromise');
export const SAGA_ACTION = sym('SAGA_ACTION');
export const konst = <T>(value: T) => () => value;
export const kTrue = konst(true);
export const kFalse = konst(false);
export const noop = () => {};
export const identity = <T>(v: T) => v;

export const isDev = process.env.NODE_ENV === 'development';

export function check(value: any, predicate: (value: any) => boolean, error: string) {
    if (!predicate(value)) {
        log('error', 'uncaught at check', error);
        throw new Error(error);
    }
}

const hasOwnProperty = Object.prototype.hasOwnProperty;

export function hasOwn(object: object, property: any) {
    return is.notUndef(object) && hasOwnProperty.call(object, property);
}

export const is = {
    undef: (v: any) => v === null || v === undefined,
    notUndef: (v: any) => v !== null && v !== undefined,
    func: (f: any) => typeof f === 'function',
    number: (n: any) => typeof n === 'number',
    array: Array.isArray,
    promise: (p: any) => p && is.func(p.then),
    iterator: (it: any) => it && is.func(it.next) && is.func(it.throw),
    task: (t: any) => t && t[TASK],
    observable: (ob: any) => ob && is.func(ob.subscribe),
    buffer: (buf: any) => buf && is.func(buf.isEmpty) && is.func(buf.take) && is.func(buf.put),
    pattern: (pat: any) => pat &&
        ((typeof pat === 'string') || (typeof pat === 'symbol') || is.func(pat) || is.array(pat)),
    channel: (ch: any) => ch && is.func(ch.take) && is.func(ch.close),
    helper: (it: any) => it && it[HELPER],
    stringableFunc: (f: any) => is.func(f) && hasOwn(f, 'toString'),
};

export function remove<T extends any>(array: T[], item: T) {
    const index = array.indexOf(item);
    if (index >= 0) {
        array.splice(index, 1);
    }
}

export function deferred<T, R>(props: R = {} as R): R & Deferrable<T> {
    const def = Object.assign({} as Deferrable<T>, props);
    const promise = new Promise<T>((resolve, reject) => {
        def.resolve = resolve;
        def.reject = reject;
    });
    def.promise = promise;
    return def;
}

export function arrayOfDeffered<T, R>(length: number): Array<Deferrable<T>> {
    const arr = [];
    for (let i = 0; i < length; i++) {
        arr.push(deferred<T, R>());
    }
    return arr;
}

export function delay<T extends boolean>(ms: number, val: T = true as T): CancelablePromise<T> {
    let timeoutId: number;
    const promise = new Promise<T>((resolve) => {
        timeoutId = window.setTimeout(() => resolve(val), ms);
    }) as CancelablePromise<T>;

    promise.CANCEL = () => window.clearTimeout(timeoutId);

    return promise;
}

export function createMockTask() {
    let running = true;
    let result: any;
    let error: string;

    return {
        [TASK]: true,
        isRunning: () => running,
        result: () => result,
        error: () => error,

        setRunning: (isRunning: boolean) => running = isRunning,
        setResult: (res: any) => result = res,
        setError: (err: string) => error = err,
    };
}

export function autoInc(seed = 0) {
    return () => ++seed;
}

export const uid = autoInc();

const kThrow = (err: Error) => { throw err; };
const kReturn = (value: any) => ({ value, done: true });
export function makeIterator(
    next: (value: any) => IteratorResult<EffectDescriptor>,
    thro = kThrow,
    name = '',
    isHelper?: boolean,
): SagaIterator {
    const iterator: SagaIterator = { name, next, throw: thro, return: kReturn };

    if (isHelper) {
        iterator.HELPER = true;
    }
    // if (typeof Symbol !== 'undefined') {
    //     iterator[Symbol.iterator] = () => iterator
    // }
    return iterator;
}

/**
    Print error in a useful way whether in a browser environment
    (with expandable error stack traces), or in a node.js environment
    (text-only log output)
 **/
export function log(level: keyof Console, message: string, error = '') {
    /*eslint-disable no-console*/
    if (typeof window === 'undefined') {
        console.log(`redux-saga ${level}: ${message}\n${(error && (error as any).stack) || error}`);
    } else {
        (console as any)[level](message, error);
    }
}

// export function deprecate(fn, deprecationWarning) {
//     return (...args) => {
//         if (isDev) log('warn', deprecationWarning)
//         return fn(...args)
//     }
// }

export const internalErr = (err: string) => new Error(`
  redux-saga: Error checking hooks detected an inconsistent state. This is likely a bug
  in redux-saga code and not yours. Thanks for reporting this in the project's github repo.
  Error: ${err}
`);

export function wrapSagaDispatch(dispatch: (actoin: any) => void) {
    return function sagaDispatch(action: any) {
        const wrappedAction = Object.defineProperty(action, SAGA_ACTION, { value: true });
        return dispatch(wrappedAction);
    };
}
