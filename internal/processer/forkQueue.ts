import { remove, noop } from '../utils';

interface ForkedTask {
    name: string;
    continue: (res: any, isErr: boolean) => void;
    cancel: () => void;
}

export default class ForkQueue {
    private tasks: ForkedTask[] = [];
    private result: any;
    private completed = false;

    constructor(private mainTask: ForkedTask, private cb: (res: any, isError: boolean) => void) {
        this.addTask(mainTask);
    }

    addTask(task: ForkedTask) {
        this.tasks.push(task);
        task.continue = (res, isErr) => {
            if (this.completed) {
                return;
            }

            remove(this.tasks, task);
            task.continue = noop;
            if (isErr) {
                this.abort(res);
            } else {
                if (task === this.mainTask) {
                    this.result = res;
                }
                if (!this.tasks.length) {
                    this.completed = true;
                    this.cb(this.result, false);
                }
            }
        }
    }

    abort(err: Error) {
        this.cancelAll();
        this.cb(err, true);
    }

    cancelAll() {
        if (this.completed) {
            return;
        }
        this.completed = true;
        this.tasks.forEach(t => {
            t.continue = noop;
            t.cancel();
        });
        this.tasks = [];
    }

    getTasks() {
        return this.tasks;
    }

    taskNames() {
        return this.tasks.map(t => t.name);
    }
}
