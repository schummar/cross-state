import fastDeepEqual from 'fast-deep-equal';
import produce, { Draft, freeze, PatchListener } from 'immer';
import { Listener } from './misc';

export type Options = {
  equals: (a: any, b: any) => boolean;
};

export class Store<T> {
  private state: T;
  private listeners = new Set<Listener<T>>();
  private notifyIsScheduled = false;
  private options: Options = {
    equals: fastDeepEqual,
  };

  constructor(state: T, options?: Partial<Options>) {
    this.state = freeze(state, true);
    Object.assign(this.options, options);
  }

  getState() {
    return this.state;
  }

  update(update: (draft: Draft<T>) => void, listener?: PatchListener) {
    this.state = produce(this.state, update, listener);
    this.scheduleNotify();
  }

  set(state: T) {
    this.state = freeze(state, true);
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
