import { Store } from 'redux';
import { check, noop, log as defaultLog, is, deferred } from '../utils';
import { SagaIterator, Subscribe, Action, Monitor, Deferrable } from '../interface';
import StdChannel from '../stdChannel';

export const NOT_ITERATOR_ERROR = 'proc first argument (Saga function result) must be an iterator'

export const CHANNEL_END = { toString() { return '@@redux-saga/CHANNEL_END' } }
export const TASK_CANCEL = { toString() { return '@@redux-saga/TASK_CANCEL' } }

interface Continue {
    cancel: () => void;
}

interface CancelableDeferred<T> extends Deferrable<T> {
    cancel: (this: CancelableDeferred<T>) => void;
}

type OnError = (err: Error) => void;

export default function processor(
    iterator: SagaIterator,
    subscribe: Subscribe<Action> = () => noop,
    dispatch = (action: Action) => action,
    getState: (...args: any[]) => any = noop,
    options: { sagaMonitor?: Monitor, logger?: typeof defaultLog, onError?: OnError } = {},
    parentEffectId = 0,
    name = 'anonymous',
    cont: Continue
) {
    check(iterator, is.iterator, NOT_ITERATOR_ERROR);

    const { sagaMonitor, logger, onError } = options;
    const log = logger || defaultLog;
    const channel = new StdChannel(subscribe);

    const deferredEffect: CancelableDeferred<any> = deferred({ cancel: noop });
    const mainTask = {name, cancel: cancelMain, isRunning: true};
    const task = newTask(parentEffectId, name, iterator, cont)

    function next(res: any, isErr: boolean) {}

    function end(res: any, isErr: boolean) {}
}
