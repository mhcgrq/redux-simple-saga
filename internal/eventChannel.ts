import Channel from './channel';
import { Action, Subscribe, Unsubscribe } from './interface';

export class EventChannel extends Channel {
    constructor(
        subscribe: Subscribe,
        buffer = buffers.none(),
        matcher,
    ) {
        super(buffer);
    }
}
