import { Subscribe, Unsubscribe } from './interface';
import { remove } from './utils';

export default class Emitter<T> {
    private subscribers: Array<Subscribe<T>> = [];

    public subscribe(sub: Subscribe<T>): Unsubscribe {
        this.subscribers.push(sub);
        return () => remove(this.subscribers, sub);
    }

    public emitter(item: any) {
        const arr = this.subscribers.slice();
        for (let i = 0, len = arr.length; i < len; i++) {
            arr[i](item);
        }
    }
}
