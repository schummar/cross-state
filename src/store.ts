import eq from 'fast-deep-equal/es6/react';
import { applyPatches, Draft, enableMapSet, enablePatches, freeze, Patch, produce } from 'immer';
import { Cancel } from './helpers/misc';
import { throttle as throttleFn } from './helpers/throttle';

export type StoreOptions = {
  /** Log errors. Default: console.error */
  log?: (...data: any[]) => void;
};

export type StoreSubscribeOptions = {
  /** Invoke callback immediately with the current value? Default: true */
  callbackNow?: boolean;
  /** Throttle invocations of callback. */
  throttle?: number;
  /** Comparison function to determine if the data has changed. Default: fast-deep-equal */
  compare?: (a: any, b: any) => boolean;
};

export type StoreAddReactionOptions = {
  /** Invoke callback immediately with the current value? Default: true */
  callbackNow?: boolean;
  /** Comparison function to determine if the data has changed. Default: fast-deep-equal */
  compare?: (a: any, b: any) => boolean;
};

const RESTART_UPDATE = Symbol('RESTART_UPDATE');

export class Store<T> {
  private subscriptions = new Set<(state: T, patches: Patch[]) => void>();
  private reactions = new Set<() => void>();
  private patches = new Array<Patch>();
  private notifyScheduled = false;
  private lock?: 'reaction';
  private options;

  constructor(private state: T, { log = (...data: any[]) => console.error(...data) }: StoreOptions = {}) {
    freeze(state, true);
    enableMapSet();
    enablePatches();

    this.options = {
      log,
    };
  }

  getState(): T {
    return this.state;
  }

  update(update: (draft: Draft<T>, original: T) => Draft<T> | void | undefined): void {
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
    { callbackNow = true, throttle = 0, compare = eq }: StoreSubscribeOptions = {}
  ): Cancel {
    const throttledListener = throttle ? throttleFn(listener, throttle) : listener;

    let value = selector(this.state);

    const internalListener = (state: T, _patches: Patch[], init?: boolean) => {
      try {
        const oldValue = value;
        value = selector(state);
        if (!init && compare(value, oldValue)) return;
        (init ? listener : throttledListener)(value, oldValue, this.state);
      } catch (e) {
        this.options.log('Failed to execute listener:', e);
      }
    };

    this.subscriptions.add(internalListener);
    if (callbackNow) internalListener(this.state, [], true);
    return () => {
      this.subscriptions.delete(internalListener);
    };
  }

  addReaction<S>(
    selector: (state: T) => S,
    reaction: (value: S, draft: Draft<T>, original: T, prev: S) => void,
    { callbackNow = true, compare = eq }: StoreAddReactionOptions = {}
  ): Cancel {
    let value = selector(this.state);

    const internalListener = (init?: boolean) => {
      let hasChanged = false;

      try {
        this.lock = 'reaction';
        const oldValue = value;
        value = selector(this.state);
        if (!init && compare(value, oldValue)) return;

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
    if (callbackNow) internalListener(true);
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
      for (const reaction of this.reactions) {
        reaction();
      }
    } catch (e) {
      return this.notify();
    }

    if (this.notifyScheduled) return;
    this.notifyScheduled = true;

    setTimeout(() => {
      this.notifyScheduled = false;

      const patches = this.patches;
      this.patches = [];
      for (const subscription of this.subscriptions) {
        subscription(this.state, patches);
      }
    });
  }
}
