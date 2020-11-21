import fastDeepEqual from 'fast-deep-equal';
import produce, { Draft, PatchListener } from 'immer';
import { Listener } from './misc';

export type Options = {
  equals: (a: any, b: any) => boolean;
};

export class Store<T> {
  private listeners = new Set<Listener<T>>();
  private notifyIsScheduled = false;
  private options: Options = {
    equals: fastDeepEqual,
  };

  constructor(private state: T, options?: Partial<Options>) {
    Object.assign(this.options, options);
  }

  getState() {
    return this.state;
  }

  update(update: (draft: Draft<T>) => void, listener?: PatchListener) {
    this.state = produce(this.state, update, listener);
    this.scheduleNotify();
  }

  subscribe<S>(selector: (state: T) => S, listener: Listener<S>) {
    let value = selector(this.state);

    const internalListener = () => {
      const newValue = selector(this.state);
      if (this.options.equals(newValue, value)) return;
      value = newValue;
      listener(value);
    };

    this.listeners.add(internalListener);
    listener(value);

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
    });
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
