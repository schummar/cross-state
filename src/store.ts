import eq from 'fast-deep-equal/es6/react';
import { applyPatches, Draft, enableMapSet, enablePatches, freeze, Patch, produce } from 'immer';
import { Cancel } from './helpers/misc';
import { throttle as throttleFn } from './helpers/throttle';

const RESTART_UPDATE = Symbol('RESTART_UPDATE');

export class Store<T> {
  private subscriptions = new Set<(state: T, patches: Patch[], inversePatches: Patch[]) => void>();
  private reactions = new Set<() => void>();
  private patches = new Array<Patch>();
  private inversePatches = new Array<Patch>();
  private notifyScheduled = false;
  private lock?: 'reaction';

  constructor(private state: T, private options = { log: (...data: any[]) => console.error(...data) }) {
    freeze(state, true);
    enableMapSet();
    enablePatches();
  }

  getState(): T {
    return this.state;
  }

  update(update: (draft: Draft<T>, original: T) => Draft<T> | void | undefined): void {
    this.checkLock();

    this.state = produce(
      this.state,
      (draft) => update(draft, this.state),
      (patches, inversePatches) => {
        this.patches.push(...patches);
        this.inversePatches.push(...inversePatches);
      }
    );
    this.notify();
  }

  set(state: T): void {
    this.checkLock();

    this.state = produce(
      this.state,
      () => state,
      (patches, inversePatches) => {
        this.patches.push(...patches);
        this.inversePatches.push(...inversePatches);
      }
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
    { runNow = true, throttle = 0 } = {}
  ): Cancel {
    const throttledListener = throttle ? throttleFn(listener, throttle) : listener;

    let value = selector(this.state);

    const internalListener = (state: T, _patches: Patch[], _inversePatches: Patch[], init?: boolean) => {
      try {
        const oldValue = value;
        value = selector(state);
        if (!init && eq(value, oldValue)) return;
        (init ? listener : throttledListener)(value, oldValue, this.state);
      } catch (e) {
        this.options.log('Failed to execute listener:', e);
      }
    };

    this.subscriptions.add(internalListener);
    if (runNow) internalListener(this.state, [], [], true);
    return () => {
      this.subscriptions.delete(internalListener);
    };
  }

  addReaction<S>(
    selector: (state: T) => S,
    reaction: (value: S, draft: Draft<T>, original: T, prev: S) => void,
    { runNow = true } = {}
  ): Cancel {
    let value = selector(this.state);

    const internalListener = (init?: boolean) => {
      let hasChanged = false;

      try {
        this.lock = 'reaction';
        const oldValue = value;
        value = selector(this.state);
        if (!init && eq(value, oldValue)) return;

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
      } finally {
        delete this.lock;
      }

      if (hasChanged && !init) throw RESTART_UPDATE;
      if (hasChanged && init) this.notify();
    };

    this.reactions.add(internalListener);
    if (runNow) internalListener(true);
    return () => {
      this.reactions.delete(internalListener);
    };
  }

  subscribePatches(listener: (patches: Patch[], inversePatches: Patch[]) => void): Cancel {
    const internalListener = (_state: T, patches: Patch[], inversePatches: Patch[]) => {
      try {
        listener(patches, inversePatches);
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
      for (const reaction of this.reactions) {
        reaction();
      }
    } catch (e) {
      return this.notify();
    }

    if (this.notifyScheduled) return;
    this.notifyScheduled = true;

    (async () => {
      await Promise.resolve();
      this.notifyScheduled = false;

      const patches = this.patches;
      const inversePatches = this.inversePatches;
      this.patches = [];
      this.inversePatches = [];
      for (const subscription of this.subscriptions) {
        subscription(this.state, patches, inversePatches);
      }
    })();
  }
}
