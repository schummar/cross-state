import eq from 'fast-deep-equal';
import produce, { Draft, freeze } from 'immer';
import { Cancel } from './misc';
import { useStoreState } from './useStoreState';

const RESTART_UPDATE = Symbol('RESTART_UPDATE');

export class Store<T> {
  private subscriptions = new Set<() => void>();
  private reactions = new Set<() => void>();
  private notifyIsScheduled = false;

  constructor(private state: T) {
    freeze(state, true);
  }

  getState(): T {
    return this.state;
  }

  update(update: (draft: Draft<T>, original: T) => void): void {
    this.state = produce(this.state, (draft) => update(draft, this.state));
    this.notify();
  }

  set(state: T): void {
    this.state = freeze(state, true);
    this.notify();
  }

  subscribe<S>(selector: (state: T) => S, listener: (value: S, prev: S | undefined, state: T) => void, { runNow = false } = {}): Cancel {
    let value = selector(this.state);

    const internalListener = () => {
      const newValue = selector(this.state);
      if (!runNow && eq(newValue, value)) return;

      listener(newValue, value, this.state);
      value = newValue;
      runNow = false;
    };

    this.subscriptions.add(internalListener);
    return () => {
      this.subscriptions.delete(internalListener);
    };
  }

  addReaction<S>(
    selector: (state: T) => S,
    reaction: (value: S, draft: Draft<T>, original: T, prev: S) => void,
    { runNow = false } = {}
  ): Cancel {
    let value = selector(this.state);

    const internalListener = () => {
      const newValue = selector(this.state);
      if (!runNow && eq(newValue, value)) return;

      let hasChanged = false;
      produce(
        this.state,
        (draft) => reaction(newValue, draft, this.state, value),
        () => {
          hasChanged = true;
        }
      );

      value = newValue;
      if (hasChanged && !runNow) throw RESTART_UPDATE;
      runNow = false;
    };

    this.reactions.add(internalListener);
    return () => {
      this.reactions.delete(internalListener);
    };
  }

  private notify(): void {
    try {
      for (const reaction of this.reactions) {
        reaction();
      }
    } catch (e) {
      if (e === RESTART_UPDATE) return this.notify();
      throw e;
    }

    if (this.notifyIsScheduled) return;
    this.notifyIsScheduled = true;

    setTimeout(() => {
      this.notifyIsScheduled = false;

      for (const subscription of this.subscriptions) {
        subscription();
      }
    }, 0);
  }

  useState(): T;
  useState<S>(selector: (state: T) => S, dependencies?: any[]): S;
  useState<S>(selector: (state: T) => S = (x) => x as any, deps?: any[]): S {
    return useStoreState(this, selector, deps);
  }
}
