import { Listener } from './misc';

export type BaseStoreOptions<T, UArgs extends any[]> = {
  equals: (a: any, b: any) => boolean;
  update: (state: T, ...args: UArgs) => T;
  freeze?: (state: T) => T;
};

export class BaseStore<T, UArgs extends any[]> {
  private listeners = new Set<Listener<T>>();
  private notifyIsScheduled = false;

  constructor(private state: T, private options: BaseStoreOptions<T, UArgs>) {}

  getState() {
    return this.state;
  }

  update(...args: UArgs) {
    this.state = this.options.update(this.state, ...args);
    this.scheduleNotify();
  }

  set(state: T) {
    this.state = this.options.freeze ? this.options.freeze(state) : state;
    this.scheduleNotify();
  }

  subscribe<S>(selector: (state: T) => S, listener: Listener<S>, triggerInital = false) {
    let value = selector(this.state);

    const internalListener = () => {
      const newValue = selector(this.state);
      if (this.options.equals(newValue, value)) return;
      value = newValue;
      listener(value);
    };

    this.listeners.add(internalListener);

    if (triggerInital) listener(value);
    return () => {
      this.listeners.delete(internalListener);
    };
  }

  private scheduleNotify() {
    if (this.notifyIsScheduled) return;
    this.notifyIsScheduled = true;
    setTimeout(() => {
      this.notifyIsScheduled = false;
      this.notify();
    }, 0);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
