import { is, sym, check, remove, internalErr } from './utils';
import { buffers, Buffer } from './buffers';
import { Action } from './interface';

export type NullableAction = Action | null;
type TakerFunction = (input: Action) => void;
type ChannelFlush = (input: NullableAction[] | typeof END) => void;

export interface Taker extends TakerFunction {
    MATCH?: (input: Action) => boolean;
}
export interface ChannelTake extends Taker {
    cancel?: () => void;
}

const CHANNEL_END_TYPE = sym('CHANNEL_END');
export const END = Object.freeze({ type: CHANNEL_END_TYPE });
export const isEnd = (action: NullableAction) => action && action.type === CHANNEL_END_TYPE;

export const INVALID_BUFFER = 'invalid buffer passed to channel factory function';
export let UNDEFINED_INPUT_ERROR = 'Saga was provided with an undefined action';

if (process.env.NODE_ENV !== 'production') {
    UNDEFINED_INPUT_ERROR += `\nHints:
    - check that your Action Creator returns a non-undefined value
    - if the Saga was started using runSaga, check that your subscribe source provides the action to its listeners
  `;
}

export default class Channel {
    private isClosed = false;
    private takers: Taker[] = [];

    constructor(private buffer: Buffer<NullableAction> = buffers.fixed<Action>()) {
        check(buffer, is.buffer, INVALID_BUFFER);
    }

    public get __takers__() { return this.takers; }
    public get __closed__() { return this.isClosed; }

    public put(input: Action) {
        this.checkForbiddenStates();
        check(input, is.notUndef, UNDEFINED_INPUT_ERROR);
        if (this.isClosed) {
            return;
        }
        if (!this.takers.length) {
            this.buffer.put(input);
            return;
        }
        for (let i = 0; i < this.takers.length; i++) {
            const taker = this.takers[i];
            if (!taker.MATCH || taker.MATCH(input)) {
                this.takers.splice(i, 1);
                taker(input);
                return;
            }
        }
    }

    public take(cb: ChannelTake) {
        this.checkForbiddenStates();
        check(cb, is.func, 'channel.take\'s callback must be a function');

        if (this.isClosed && this.buffer.isEmpty()) {
            cb(END);
        } else if (!this.buffer.isEmpty()) {
            cb((this.buffer.take() as Action));
        } else {
            this.takers.push(cb);
            cb.cancel = () => remove(this.takers, cb);
        }
    }

    public flush(cb: ChannelFlush) {
        this.checkForbiddenStates(); // TODO: check if some new state should be forbidden now
        check(cb, is.func, 'channel.flush\' callback must be a function');
        if (this.isClosed && this.buffer.isEmpty()) {
            cb(END);
            return;
        }
        cb(this.buffer.flush());
    }

    public close() {
        this.checkForbiddenStates();
        if (!this.isClosed) {
            this.isClosed = true;
            if (this.takers.length) {
                const arr = this.takers;
                this.takers = [];
                for (let i = 0, len = arr.length; i < len; i++) {
                    arr[i](END);
                }
            }
        }
    }

    private checkForbiddenStates() {
        if (closed && this.takers.length) {
            throw internalErr('Cannot have a closed channel with pending takers');
        }
        if (this.takers.length && !this.buffer.isEmpty()) {
            throw internalErr('Cannot have pending takers with non empty buffer');
        }
    }
}
