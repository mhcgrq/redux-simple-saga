import { BufferLike } from './interface';

export const BUFFER_OVERFLOW = 'Channel\'s Buffer overflow!';

enum OVERFLOW {
    THROW,
    DROP,
    SLIDE,
    EXPAND,
}

const defaultLimit = 10;

export class Buffer<T> implements BufferLike<T | null> {
    private arr: Array<T | null>;
    private length = 0;
    private pushIndex = 0;
    private popIndex = 0;

    constructor(private overflowAction: OVERFLOW, private limit = defaultLimit) {}

    public isEmpty() {
        return this.length === 0;
    }

    public put(value: T) {
        if (this.length < this.limit) {
            this.push(value);
        } else {
            let doubledLimit;
            switch (this.overflowAction) {
                case OVERFLOW.THROW:
                    throw new Error(BUFFER_OVERFLOW);
                case OVERFLOW.SLIDE:
                    this.arr[this.pushIndex] = value;
                    this.pushIndex = (this.pushIndex + 1) % this.limit;
                    this.popIndex = this.pushIndex;
                    break;
                case OVERFLOW.EXPAND:
                    doubledLimit = 2 * this.limit;
                    this.arr = this.flush();

                    this.length = this.arr.length;
                    this.pushIndex = this.arr.length;
                    this.popIndex = 0;

                    this.arr.length = doubledLimit;
                    this.limit = doubledLimit;

                    this.push(value);
                    break;
                default:
                    break;
                    // DROP
            }
        }
    }

    public take() {
        if (this.length !== 0) {
            const value = this.arr[this.popIndex];
            this.arr[this.popIndex] = null;
            this.length--;
            this.popIndex = (this.popIndex + 1) % this.limit;
            return value;
        }
        return null;
    }

    public flush(): Array<T | null> {
        const items = [];
        while (this.length > 0) {
            items.push(this.take());
        }
        return items;
    }

    private push(value: T) {
        this.arr[this.pushIndex] = value;
        this.pushIndex = (this.pushIndex + 1) % this.limit;
        this.length++;
    }
}

export const buffers = {
    none: () => new Buffer<null>(0, OVERFLOW.DROP),
    fixed: <T>(limit = defaultLimit) => new Buffer<T>(limit, OVERFLOW.THROW),
    dropping: <T>(limit = defaultLimit) => new Buffer<T>(limit, OVERFLOW.DROP),
    sliding: <T>(limit = defaultLimit) => new Buffer<T>(limit, OVERFLOW.SLIDE),
    expanding: <T>(initialSize = defaultLimit) => new Buffer<T>(initialSize, OVERFLOW.EXPAND),
};
