import eq from 'fast-deep-equal/es6/react';
import produce, { applyPatches, Draft, enablePatches, freeze, Patch } from 'immer';
import { Cancel } from './helpers/misc';
import { throttle as throttleFn } from './helpers/throttle';

enablePatches();

const RESTART_UPDATE = Symbol('RESTART_UPDATE');

export class Store<T> {
  private subscriptions = new Set<(state: T, patches: Patch[]) => void>();
  private reactions = new Set<() => void>();
  private patches = new Array<Patch>();
  private notifyScheduled = false;
  private lock?: 'reaction';

  constructor(private state: T, private options = { log: console.error }) {
    freeze(state, true);
  }

  getState(): T {
    return this.state;
  }

  update(update: (draft: Draft<T>, original: T) => void): void {
    this.checkLock();

    this.state = produce(
      this.state,
      (draft) => update(draft, this.state),
      (patches) => this.patches.push(...patches)
    );
    this.notify();
  }

  set(state: T): void {
    this.checkLock();

    this.state = produce(
      this.state,
      () => state,
      (patches) => this.patches.push(...patches)
    ) as T;
    this.notify();
  }

  applyPatches(patches: Patch[]): void {
    this.checkLock();

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

    const internalListener = (state: T, _patches: Patch[], force?: boolean) => {
      try {
        const oldValue = value;
        value = selector(state);
        if (!force && eq(value, oldValue)) return;
        listener(value, oldValue, this.state);
      } catch (e) {
        this.options.log('Failed to execute listener:', e);
      }
    };

    if (runNow) internalListener(this.state, [], true);
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
      let hasChanged = false;

      try {
        const oldValue = value;
        value = selector(this.state);
        if (!force && eq(value, oldValue)) return;

        this.state = produce(
          this.state,
          (draft) => reaction(value, draft, this.state, oldValue),
          (patches) => {
            hasChanged = true;
            this.patches.push(...patches);
          }
        );
      } catch (e) {
        this.options.log('Failed to execute reaction:', e);
      }

      if (hasChanged && !force) throw RESTART_UPDATE;
    };

    if (runNow) internalListener(true);
    this.reactions.add(internalListener);
    return () => {
      this.reactions.delete(internalListener);
    };
  }

  subscribePatches(listener: (patches: Patch[]) => void): Cancel {
    const internalListener = (_state: T, patches: Patch[]) => {
      try {
        listener(patches);
      } catch (e) {
        this.options.log('Failed to execute patch listener:', e);
      }
    };

    this.subscriptions.add(internalListener);
    return () => {
      this.subscriptions.delete(internalListener);
    };
  }

  private checkLock() {
    if (this.lock === 'reaction') {
      throw Error('You cannot call update from within a reaction. Use the passed draft instead.');
    }
  }

  private notify(): void {
    try {
      this.lock = 'reaction';
      for (const reaction of this.reactions) {
        reaction();
      }
    } catch (e) {
      return this.notify();
    } finally {
      delete this.lock;
    }

    if (this.notifyScheduled) return;
    this.notifyScheduled = true;

    (async () => {
      await Promise.resolve();
      this.notifyScheduled = false;

      for (const subscription of this.subscriptions) {
        subscription(this.state, this.patches);
      }

      this.patches = [];
    })();
  }
}
