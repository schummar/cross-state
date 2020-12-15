import { Cancel } from './misc';

export type BaseStoreOptions<T, UArgs extends any[]> = {
  equals: (a: any, b: any) => boolean;
  update: (state: T, ...args: UArgs) => T;
  freeze?: (state: T) => T;
};

export type Listener<T> = (value: T) => void;

export class BaseStore<T, UArgs extends any[]> {
  private listeners = new Set<Listener<T>>();
  private immediateListeners = new Set<Listener<T>>();
  private notifyIsScheduled = false;

  constructor(private state: T, private options: BaseStoreOptions<T, UArgs>) {}

  getState(): T {
    return this.state;
  }

  update(...args: UArgs): void {
    this.state = this.options.update(this.state, ...args);
    this.notify();
  }

  set(state: T): void {
    this.state = this.options.freeze ? this.options.freeze(state) : state;
    this.notify();
  }

  subscribe<S>(selector: (state: T) => S, listener: Listener<S>, triggerInital = false): Cancel {
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

  addReaction(selector: (state: T) => S, listener: Listener<S>, ...args: UArgs) {
    let value = selector(this.state);

    const internalListener = () => {
      const newValue = selector(this.state);
      if (this.options.equals(newValue, value)) return;
      value = this.options.update();
    };
  }

  private notify(): void {
    for (const listener of this.immediateListeners) {
      listener(this.state);
    }

    if (this.notifyIsScheduled) return;
    this.notifyIsScheduled = true;

    setTimeout(() => {
      this.notifyIsScheduled = false;

      for (const listener of this.listeners) {
        listener(this.state);
      }
    }, 0);
  }
}
