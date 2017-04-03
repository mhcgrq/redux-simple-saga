import { ChannelTake } from './channel';
import EventChannel from './eventChannel';
import { Action, Subscribe } from './interface';
import { asap } from './scheduler';
import { check, is } from './utils';

export default class StdChannel extends EventChannel {
    constructor(subscribe: Subscribe<Action>) {
        const wrappedSubscribe = (cb: (input: Action) => void) =>
            subscribe((input) => {
                if (input.SAGA_ACTION) {
                    cb(input);
                    return;
                }
                asap(() => cb(input));
            });
        super(wrappedSubscribe);
    }

    public take(cb: ChannelTake, matcher?: (input: Action) => boolean) {
        if (arguments.length > 1) {
            check(matcher, is.func, 'channel.take\'s matcher argument must be a function');
            cb.MATCH = matcher;
        }
        super.take(cb);
    }
}
