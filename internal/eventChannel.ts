import Channel, { NullableAction, isEnd } from './channel';
import { buffers, Buffer } from './buffers';
import { Action, Subscribe, Unsubscribe } from './interface';
import { check, is } from './utils';

export default class EventChannel extends Channel {
    private unsubscribe: Unsubscribe;

    constructor(
        subscribe: Subscribe<Action>,
        buffer: Buffer<NullableAction> = buffers.none(),
        matcher?: (input: NullableAction) => boolean,
    ) {
        super(buffer);

        if (arguments.length > 2) {
            check(matcher, is.func, 'Invalid match function passed to eventChannel');
        }

        this.unsubscribe = subscribe((input) => {
            if (isEnd(input)) {
                super.close();
                return;
            }
            if (matcher && !matcher(input)) {
                return;
            }
            this.put(input);
        });

        if (!is.func(this.unsubscribe)) {
            throw new Error('in eventChannel: subscribe should return a function to unsubscribe');
        }
    }

    public close() {
        if (!this.__closed__) {
            super.close();
            this.unsubscribe();
        }
    }
}
