import {Action, Middleware} from 'redux';
import { sym } from './utils';

export interface Task {
    readonly TASK: string;
}

export interface BufferLike<T> {
    isEmpty: () => boolean;
    take: () => T;
    put: (value: T) => void;
    flush: () => T[];
}

export interface Channel<T> {
    take: () => T;
    close: () => void;
}

export interface Helper {
    HELPER?: boolean;
}

export interface Stringable extends Function {
    toString: () => string;
}

export interface Deferrable<T> {
    promise: Promise<T>;
    reject: (value?: T | PromiseLike<T> | undefined) => void;
    resolve: (reason?: any) => void;
}

export interface SagaIterator<T> extends Iterator<T>, Helper {
    name: string;
}

export interface Cancelable {
    CANCEL: () => void;
}

export interface CancelablePromise<T> extends Promise<T>, Cancelable {}

export interface Action {
    readonly type: string | symbol;
    SAGA_ACTION?: boolean;
}

export interface Monitor {
    effectTriggered(desc: {
        effectId: number;
        parentEffectId: number;
        label: string;
        root?: boolean;
        effect: Effect;
    }): void;

    effectResolved(effectId: number, res: any): void;
    effectRejected(effectId: number, err: any): void;
    effectCancelled(effectId: number): void;
    actionDispatched<A extends Action>(action: A): void;
}

export interface Task {
    done: Promise<any>;
    isRunning(): boolean;
    isCancelled(): boolean;
    result(): any;
    result<T>(): T;
    error(): any;
    cancel(): void;
}

export type Pattern = string | symbol | ((value: any) => boolean) | string[];
export type Unsubscribe = () => void;
export type Subscribe<T> = (cb: (input: T) => void) => Unsubscribe;
