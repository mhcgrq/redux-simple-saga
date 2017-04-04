import { sym, is, identity, check, TASK } from './utils';
import { takeEveryHelper, takeLatestHelper, throttleHelper } from './sagaHelpers';
import Channel from './channel';
import { Pattern, Action } from './interface';

enum EffectName {
    TAKE,
    PUT,
    RACE,
    CALL,
    CPS,
    FORK,
    JOIN,
    CANCEL,
    SELECT,
    ACTION_CHANNEL,
    CANCELLED,
    FLUSH,
}

interface EffectDescriptor {
    IO: boolean;
    type: EffectName;
    payload: EffectPayloadDescriptor;
}

type AnyArg = any[];
type AnyFunction = (...args: AnyArg) => any;

type EffectPayloadDescriptor =
    TakePatternEffectPayloadDescriptor |
    TakeChannelEffectPayloadDescriptor |
    PutEffectPayloadDescriptor |
    RaceEffectPayloadDescriptor |
    FunctionCallDescriptor |
    SelectEffectPayloadDescriptor |
    ActionChannelEffectPayloadDescriptor |
    CancelledEffectPayloadDescriptor |
    FlushEffectPayloadDescriptor;

const effect = (type: EffectName, payload: EffectPayloadDescriptor): EffectDescriptor => ({
    IO: true,
    type,
    payload,
});

interface TakePatternEffectPayloadDescriptor {
    pattern: Pattern;
    maybe?: boolean;
}
interface TakeChannelEffectPayloadDescriptor {
    channel: Channel;
    maybe?: boolean;
}

export function take(patternOrChannel: Pattern | Channel): EffectDescriptor {
    if (arguments.length) {
        check(arguments[0], is.notUndef, 'take(patternOrChannel): patternOrChannel is undefined');
    }
    if (is.pattern(patternOrChannel)) {
        return effect(EffectName.TAKE, { pattern: patternOrChannel as Pattern });
    }
    if (is.channel(patternOrChannel)) {
        return effect(EffectName.TAKE, { channel: patternOrChannel as Channel });
    }
    throw new Error(
        `take(patternOrChannel): argument ${String(patternOrChannel)} is not valid channel or a valid pattern`,
    );
}

export function takem(patternOrChannel: Pattern | Channel): EffectDescriptor {
    const eff = take(patternOrChannel);
    (eff.payload as TakePatternEffectPayloadDescriptor | TakeChannelEffectPayloadDescriptor).maybe = true;
    return eff;
}

interface PutEffectPayloadDescriptor {
    action: Action;
    channel: Channel;
    resolve?: boolean;
}

export function put(action: Action): EffectDescriptor;
export function put(channel: Channel, action: Action): EffectDescriptor;
export function put(...args: AnyArg): EffectDescriptor {
    let action;
    let channel;
    if (args.length > 1) {
        check(args[0], is.notUndef, 'put(channel, action): argument channel is undefined');
        check(args[0], is.channel, `put(channel, action): argument ${args[0]} is not a valid channel`);
        check(args[1], is.notUndef, 'put(channel, action): argument action is undefined');
        channel = args[0];
        action = args[1];
    } else {
        check(args[0], is.notUndef, 'put(action): argument action is undefined');
        action = args[0];
        channel = null;
    }
    return effect(EffectName.PUT, { channel, action });
}

export function resolve(action: Action): EffectDescriptor;
export function resolve(channel: Channel, action: Action): EffectDescriptor;
export function resolve(...args: AnyArg): EffectDescriptor {
    const eff = args.length === 1 ? put(args[0] as Action) : put(args[0] as Channel, args[1] as Action);
    (eff.payload as PutEffectPayloadDescriptor).resolve = true;
    return eff;
}

interface RaceEffectPayloadDescriptor {
    effects: EffectDescriptor[];
}

export function race(effects: EffectDescriptor[]) {
    return effect(EffectName.RACE, { effects });
}

interface FunctionCallDescriptor {
    context: any;
    fn: AnyFunction;
    args: AnyArg;
    detached?: boolean;
}

function getFnCallDesc(meth: any, fn: any, args: AnyArg) {
    check(fn, is.notUndef, `${meth}: argument fn is undefined`);

    let context = null;
    if (is.array(fn)) {
        [context, fn] = fn;
    } else if (fn.fn) {
        ({ context, fn } = fn);
    }
    check(fn, is.func, `${meth}: argument ${fn} is not a function`);

    return { context, fn, args };
}

export function call(fn: AnyFunction, ...args: AnyArg) {
    return effect(EffectName.CALL, getFnCallDesc('call', fn, args));
}

export function apply(context: any, fn: AnyFunction, args: AnyArg = []) {
    return effect(EffectName.CALL, getFnCallDesc('apply', { context, fn }, args));
}

export function cps(fn: AnyFunction, ...args: AnyArg) {
    return effect(EffectName.CPS, getFnCallDesc('cps', fn, args));
}

export function fork(fn: AnyFunction, ...args: AnyArg) {
    return effect(EffectName.FORK, getFnCallDesc('fork', fn, args));
}

export function spawn(fn: AnyFunction, ...args: AnyArg) {
    const eff = fork(fn, ...args);
    (eff.payload as FunctionCallDescriptor).detached = true;
    return eff;
}

const isForkedTask = (task: EffectDescriptor) => task.type === EffectName.FORK;

export function join(task: EffectDescriptor): EffectDescriptor;
export function join(task: EffectDescriptor[]): EffectDescriptor[];
export function join(task: EffectDescriptor | EffectDescriptor[]): EffectDescriptor | EffectDescriptor[] {
    if (is.array(task)) {
        return task.map((t: EffectDescriptor) => join(t));
    }
    check(task, is.notUndef, 'join(task): argument task is undefined');
    if (!isForkedTask(task)) {
        throw new Error(
            `join(task): argument ${task} is not a valid Task object.
            (HINT: if you are getting this errors in tests, consider using createMockTask from redux-saga/utils)`,
        );
    }

    return effect(EffectName.JOIN, task.payload);
}

export function cancel(task: EffectDescriptor) {
    check(task, is.notUndef, 'cancel(task): argument task is undefined');
    if (!isForkedTask(task)) {
        throw new Error(
            `cancel(task): argument ${task} is not a valid Task object
            (HINT: if you are getting this errors in tests, consider using createMockTask from redux-saga/utils)`,
        );
    }

    return effect(EffectName.CANCEL, task.payload);
}

interface SelectEffectPayloadDescriptor {
    selector: AnyFunction;
    args: AnyArg;
}

export function select<T>(selector: (...args: AnyArg) => T, ...args: AnyArg) {
    if (arguments.length === 0) {
        selector = identity;
    } else {
        check(selector, is.notUndef, 'select(selector,[...]): argument selector is undefined');
        check(selector, is.func, `select(selector,[...]): argument ${selector} is not a function`);
    }
    return effect(EffectName.SELECT, { selector, args });
}

/**
  channel(pattern, [buffer])    => creates an event channel for store actions
**/
interface ActionChannelEffectPayloadDescriptor {
    pattern: Pattern;
    buffer: Buffer;
}

export function actionChannel(pattern: Pattern, buffer: Buffer) {
    check(pattern, is.notUndef, 'actionChannel(pattern,...): argument pattern is undefined');
    if (arguments.length > 1) {
        check(buffer, is.notUndef, 'actionChannel(pattern, buffer): argument buffer is undefined');
        check(buffer, is.buffer, `actionChannel(pattern, buffer): argument ${buffer} is not a valid buffer`);
    }
    return effect(EffectName.ACTION_CHANNEL, { pattern, buffer });
}

interface CancelledEffectPayloadDescriptor {}

export function cancelled() {
    return effect(EffectName.CANCELLED, {});
}

interface FlushEffectPayloadDescriptor {
    channel: Channel;
}

export function flush(channel: Channel) {
    check(channel, is.channel, `flush(channel): argument ${channel} is not valid channel`);
    return effect(EffectName.FLUSH, channel);
}

// export function takeEvery(patternOrChannel, worker, ...args) {
//     return fork(takeEveryHelper, patternOrChannel, worker, ...args);
// }

// export function takeLatest(patternOrChannel, worker, ...args) {
//     return fork(takeLatestHelper, patternOrChannel, worker, ...args);
// }

// export function throttle(ms, pattern, worker, ...args) {
//     return fork(throttleHelper, ms, pattern, worker, ...args);
// }

const createAsEffectType = (type: EffectName) =>
    (effect: EffectDescriptor) => {
        if (!effect || !effect.IO || effect.type !== type) {
            return null;
        }
        return effect.payload;
    };

export const asEffect = {
    take: createAsEffectType(EffectName.TAKE),
    put: createAsEffectType(EffectName.PUT),
    race: createAsEffectType(EffectName.RACE),
    call: createAsEffectType(EffectName.CALL),
    cps: createAsEffectType(EffectName.CPS),
    fork: createAsEffectType(EffectName.FORK),
    join: createAsEffectType(EffectName.JOIN),
    cancel: createAsEffectType(EffectName.CANCEL),
    select: createAsEffectType(EffectName.SELECT),
    actionChannel: createAsEffectType(EffectName.ACTION_CHANNEL),
    cancelled: createAsEffectType(EffectName.CANCELLED),
    flush: createAsEffectType(EffectName.FLUSH),
};
