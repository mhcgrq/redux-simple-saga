import { END } from './channel';
import { makeIterator, delay, is } from './utils';
import { take, fork, cancel, actionChannel, call, EffectDescriptor } from './io';
import { buffers } from './buffers';
import { Pattern, Saga, Action } from './interface';
import Channel from './channel';

const done = { done: true, value: undefined };
const endState = 'END';

type statePtr<T> = keyof FSM<T>;
type UpdateExternalState = (arg: any) => any;
interface FSM<T> {
    [state: string]: () => {
        state: statePtr<T>,
        output?: IteratorResult<T | undefined>,
        updateExternalState?: UpdateExternalState,
    };
}

function fsmIterator<T>(fsm: FSM<T>, entryState: statePtr<T>, name = 'iterator') {
    let updateState: UpdateExternalState | undefined;
    let nextState = entryState;

    function next(arg: any, error: Error) {
        if (nextState === endState) {
            return done;
        }

        if (error) {
            nextState = endState;
            throw error;
        } else {
            updateState && updateState(arg);
            const { state: _state, output: _output, updateExternalState } = fsm[nextState]();
            nextState = _state;
            updateState = updateExternalState;
            return nextState === endState ? done : (_output as IteratorResult<T | undefined>);
        }
    }

    return makeIterator(
        next,
        (error: Error) => next(null, error),
        name,
        true,
    );
}

function safeName(patternOrChannel: Pattern | Pattern[] | Channel) {
    if (is.channel(patternOrChannel)) {
        return 'channel';
    } else if (Array.isArray(patternOrChannel)) {
        return String((patternOrChannel as Pattern[]).map((entry) => String(entry)));
    } else {
        return String(patternOrChannel);
    }
}

export function takeEveryHelper(patternOrChannel: Pattern | Channel, worker: Saga, ...args: any[]) {
    const yTake = { done: false, value: take(patternOrChannel) };
    const yFork = (ac: Action) => ({ done: false, value: fork(worker, ...args, ac) });

    let incomingAction: Action;
    const setAction = (ac: Action) => incomingAction = ac;

    return fsmIterator<EffectDescriptor>(
        {
            q1: () => ({ state: 'q2', output: yTake, updateExternalState: setAction }),
            q2: () => incomingAction === END
                ? ({ state: endState })
                : ({ state: 'q1', output: yFork(incomingAction) })
        },
        'q1',
        `takeEvery(${safeName(patternOrChannel)}, ${worker.name})`
    );
}

export function takeLatestHelper(patternOrChannel: Pattern | Channel, worker: Saga, ...args: any[]) {
    const yTake = { done: false, value: take(patternOrChannel) };
    const yFork = (ac: Action) => ({ done: false, value: fork(worker, ...args, ac) });
    const yCancel = (task: EffectDescriptor) => ({ done: false, value: cancel(task) });

    let currentTask: EffectDescriptor;
    let incomingAction: Action;
    const setTask = (t: EffectDescriptor) => currentTask = t;
    const setAction = (ac: Action) => incomingAction = ac;

    return fsmIterator(
        {
            q1: () => ({ state: 'q2', output: yTake, updateExternalState: setAction }),
            q2: () => incomingAction === END
                ? ({ state: endState })
                : currentTask
                    ? ({ state: 'q3', output: yCancel(currentTask) })
                    : ({ state: 'q1', output: yFork(incomingAction), updateExternalState: setTask }),
            q3: () => ({ state: 'q1', output: yFork(incomingAction), updateExternalState: setTask }),
        },
        'q1',
        `takeLatest(${safeName(patternOrChannel)}, ${worker.name})`
    );
}

export function throttleHelper(delayLength: number, pattern: Pattern, worker: Saga, ...args: any[]) {
    let action: Action;
    let channel: Channel;

    const yActionChannel = { done: false, value: actionChannel(pattern, buffers.sliding<Action>(1)) };
    const yTake = () => ({ done: false, value: take(channel) });
    const yFork = (ac: Action) => ({ done: false, value: fork(worker, ...args, ac) });
    const yDelay = { done: false, value: call(delay, delayLength) };

    const setAction = (ac: Action) => action = ac;
    const setChannel = (ch: Channel) => channel = ch;

    return fsmIterator(
        {
            q1: () => ({ state: 'q2', output: yActionChannel, updateExternalState: setChannel }),
            q2: () => ({ state: 'q3', output: yTake(), updateExternalState: setAction }),
            q3: () => action === END
                ? ({ state: endState })
                : ({ state: 'q4', output: yFork(action) }),
                q4: () => ({ state: 'q2', output: yDelay })
        },
        'q1',
        `throttle(${safeName(pattern)}, ${worker.name})`
    );
}
