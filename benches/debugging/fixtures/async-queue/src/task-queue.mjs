export class TaskQueue {
  constructor() {
    this.items = [];
    this.pumping = false;
    this.idleWaiters = [];
  }

  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.items.push({ fn, resolve, reject });
      this._schedule();
    });
  }

  onIdle() {
    if (!this.pumping && this.items.length === 0) return Promise.resolve();
    return new Promise((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  _schedule() {
    if (this.pumping) return;
    this.pumping = true;
    queueMicrotask(() => {
      this.pumping = false;
      void this._drain();
    });
  }

  async _drain() {
    while (this.items.length > 0) {
      const item = this.items.shift();
      try {
        const value = await item.fn();
        this._flushIdle();
        item.resolve(value);
      } catch (error) {
        item.reject(error);
        return;
      }
    }
  }

  _flushIdle() {
    if (this.pumping || this.items.length > 0) return;
    const waiters = this.idleWaiters.splice(0, this.idleWaiters.length);
    for (const resolve of waiters) resolve();
  }
}
