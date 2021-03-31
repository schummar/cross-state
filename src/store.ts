import eq from 'fast-deep-equal/es6/react';
import produce, { applyPatches, Draft, enablePatches, freeze, Patch } from 'immer';
import { Cancel } from './misc';
import { throttle as throttleFn } from './throttle';
import { useStoreState } from './useStoreState';

enablePatches();

const RESTART_UPDATE = Symbol('RESTART_UPDATE');

export class Store<T> {
  private subscriptions = new Set<(patches: Patch[]) => void>();
  private reactions = new Set<() => void>();
  private patches = new Array<Patch>();

  constructor(private state: T) {
    freeze(state, true);
  }

  getState(): T {
    return this.state;
  }

  update(update: (draft: Draft<T>, original: T) => void): void {
    this.state = produce(
      this.state,
      (draft) => update(draft, this.state),
      (patches) => this.patches.push(...patches)
    );
    this.notify();
  }

  set(state: T): void {
    this.state = produce(
      this.state,
      () => state,
      (patches) => this.patches.push(...patches)
    ) as T;
    this.notify();
  }

  applyPatches(patches: Patch[]): void {
    this.state = applyPatches(this.state, patches);
    this.patches.push(...patches);
    this.notify();
  }

  subscribe<S>(
    selector: (state: T) => S,
    listener: (value: S, prev: S | undefined, state: T) => void,
    { runNow = false, throttle = 0 } = {}
  ): Cancel {
    if (throttle) listener = throttleFn(listener, throttle);

    let value = selector(this.state);

    const internalListener = (_patches: Patch[], force?: boolean) => {
      const newValue = selector(this.state);
      if (!force && eq(newValue, value)) return;

      listener(newValue, value, this.state);
      value = newValue;
    };

    if (runNow) internalListener([], true);
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

    const internalListener = (force?: boolean) => {
      const newValue = selector(this.state);
      if (!force && eq(newValue, value)) return;

      let hasChanged = false;
      produce(
        this.state,
        (draft) => reaction(newValue, draft, this.state, value),
        (patches) => {
          hasChanged = true;
          this.patches.push(...patches);
        }
      );

      value = newValue;
      if (hasChanged && !force) throw RESTART_UPDATE;
    };

    if (runNow) internalListener(true);
    this.reactions.add(internalListener);
    return () => {
      this.reactions.delete(internalListener);
    };
  }

  subscribePatches(listener: (patches: Patch[]) => void): Cancel {
    this.subscriptions.add(listener);
    return () => {
      this.subscriptions.delete(listener);
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

    const patches = this.patches;
    this.patches = [];

    for (const subscription of this.subscriptions) {
      subscription(patches);
    }
  }

  useState(options?: { throttle?: number }): T;
  useState<S>(selector: (state: T) => S, dependencies?: any[], options?: { throttle?: number }): S;
  useState(...args: any[]): any {
    return useStoreState(this, ...args);
  }
}
