import { Draft, enableMapSet } from 'immer';
import { clearTimeout } from 'timers';
import { hash } from './helpers/hash';
import { Cancel } from './helpers/misc';
import retry from './helpers/retry';
import { Store } from './store';

type Result<Value> = { kind: 'value'; value: Value; t: Date } | { kind: 'error'; error: unknown; t: Date };
type Instance<Arg, Value> = {
  arg: Arg;
  current?: Result<Value>;
  inProgress?: Promise<Value>;
  invalid?: boolean;
  invalidateTimer?: NodeJS.Timeout;
  clearTimer?: NodeJS.Timeout;
};

export class Action<Arg, Value> {
  static allActions = new Array<Action<any, any>>();
  static options: {
    invalidateAfter?: number | ((value: unknown | undefined, error: unknown | undefined) => number | undefined);
    clearAfter?: number | ((value: unknown | undefined, error: unknown | undefined) => number | undefined);
  } = {};

  static clearCacheAll(): void {
    for (const action of Action.allActions) {
      action.clearCacheAll();
    }
  }

  private cache = new Store(new Map<string, Instance<Arg, Value>>());

  constructor(
    private action: (arg: Arg) => Promise<Value>,
    private options: {
      invalidateAfter?: number | ((value: Value | undefined, error: unknown | undefined) => number | undefined);
      clearAfter?: number | ((value: Value | undefined, error: unknown | undefined) => number | undefined);
    } = {}
  ) {
    Action.allActions.push(this);
    enableMapSet();
  }

  getCache(arg: Arg): Instance<Arg, Value> | undefined {
    const key = hash(arg);
    return this.cache.getState().get(key);
  }

  getCacheValue(arg: Arg): Value | undefined {
    const instance = this.getCache(arg);
    return instance?.current?.kind === 'value' ? instance.current.value : undefined;
  }

  getCacheError(arg: Arg): unknown {
    const instance = this.getCache(arg);
    return instance?.current?.kind === 'error' ? instance.current.error : undefined;
  }

  setCache(arg: Arg, value: Value): void {
    this.updateInstance(arg, (instance) => {
      instance.current = { kind: 'value', value: value as Draft<Value>, t: new Date() };
      delete instance.inProgress;
      instance.invalid = false;
    });
    this.setTimers(arg);
  }

  updateCache(arg: Arg, update: (draft: Draft<Value>) => void): boolean {
    let found = false;

    this.updateInstance(arg, (instance) => {
      if (instance.current?.kind === 'value') {
        update(instance.current.value);
        instance.invalid = false;

        found = true;
      }
    });
    if (found) {
      this.setTimers(arg);
    }

    return found;
  }

  updateCacheAll(update: (draft: Draft<Value>, arg: Arg) => void): void {
    this.cache.update((state) => {
      for (const instance of state.values()) {
        if (instance.current?.kind === 'value') {
          update(instance.current.value, instance.arg as Arg);
          instance.invalid = false;
        }
      }
    });
    for (const instance of this.cache.getState().values()) {
      if (instance.current?.kind === 'value') {
        this.setTimers(instance.arg);
      }
    }
  }

  clearCache(arg: Arg): void {
    const key = hash(arg);
    this.cache.update((state) => {
      const instance = state.get(key);
      if (instance?.invalidateTimer) {
        clearTimeout(instance.invalidateTimer);
      }
      if (instance?.clearTimer) {
        clearTimeout(instance.clearTimer);
      }

      state.delete(key);
    });
  }

  clearCacheAll(): void {
    for (const { arg } of this.cache.getState().values()) {
      this.clearCache(arg);
    }
  }

  invalidateCache(arg: Arg): void {
    const key = hash(arg);

    this.cache.update((state) => {
      const instance = state.get(key);
      if (instance) {
        delete instance.inProgress;
        instance.invalid = true;
      }
      if (instance?.invalidateTimer) {
        clearTimeout(instance.invalidateTimer);
        delete instance.invalidateTimer;
      }
    });
  }

  invalidateCacheAll(): void {
    for (const { arg } of this.cache.getState().values()) {
      this.invalidateCache(arg);
    }
  }

  async get(arg: Arg, { clearBeforeUpdate = false, retries = 0 } = {}): Promise<Value> {
    const key = hash(arg);
    const fromCache = this.cache.getState().get(key);

    if (fromCache?.current && !fromCache.invalid) {
      if (fromCache.current.kind === 'value') return fromCache.current.value;
      else throw fromCache.current.error;
    }

    if (fromCache?.inProgress) {
      return fromCache.inProgress;
    }

    return this.execute(arg, { clearBeforeUpdate, retries });
  }

  async execute(arg: Arg, { clearBeforeUpdate = false, retries = 0 } = {}): Promise<Value> {
    const key = hash(arg);

    const task = retry(() => this.action(arg), retries);

    this.updateInstance(arg, (instance) => {
      if (clearBeforeUpdate) delete instance.current;
      instance.inProgress = task;
    });

    try {
      const value = await task;

      if (task === this.cache.getState().get(key)?.inProgress) {
        this.setCache(arg, value);
      }

      return value;
    } catch (e) {
      if (task === this.cache.getState().get(key)?.inProgress) {
        this.updateInstance(arg, (instance) => {
          instance.current = { kind: 'error', error: e, t: new Date() };
          delete instance.inProgress;
          instance.invalid = false;
        });
        this.setTimers(arg);
      }

      throw e;
    }
  }

  setTimers(arg: Arg): void {
    const instance = this.updateInstance(arg, (instance) => {
      if (instance.invalidateTimer) {
        clearTimeout(instance.invalidateTimer);
        delete instance.invalidateTimer;
      }
      if (instance.clearTimer) {
        clearTimeout(instance.clearTimer);
        delete instance.clearTimer;
      }
    });

    let { invalidateAfter = Action.options.invalidateAfter, clearAfter = Action.options.clearAfter } = this.options;

    if (invalidateAfter instanceof Function) {
      invalidateAfter = invalidateAfter(
        instance.current?.kind === 'value' ? instance.current.value : undefined,
        instance.current?.kind === 'error' ? instance.current.error : undefined
      );
    }

    if (clearAfter instanceof Function) {
      clearAfter = clearAfter(
        instance.current?.kind === 'value' ? instance.current.value : undefined,
        instance.current?.kind === 'error' ? instance.current.error : undefined
      );
    }

    let invalidateTimer: NodeJS.Timeout | undefined, clearTimer: NodeJS.Timeout | undefined;

    if (invalidateAfter !== undefined && invalidateAfter !== Infinity) {
      invalidateTimer = setTimeout(() => {
        console.log('invalidate');
        this.invalidateCache(arg);
      }, invalidateAfter);
    }

    if (clearAfter !== undefined && clearAfter !== Infinity) {
      clearTimer = setTimeout(() => {
        console.log('clear');
        this.clearCache(arg);
      }, clearAfter);
    }

    this.updateInstance(arg, (instance) => {
      instance.invalidateTimer = invalidateTimer;
      instance.clearTimer = clearTimer;
    });
  }

  subscribe(
    arg: Arg,
    listener: (value: Value | undefined, state: { error?: unknown; isLoading: boolean }, instance: Instance<Arg, Value>) => void,
    { runNow, throttle }: { runNow?: boolean; throttle?: number } = {}
  ): Cancel {
    const key = hash(arg);
    return this.cache.subscribe(
      (state) => state.get(key) ?? { arg },
      (instance) =>
        listener(
          instance.current?.kind === 'value' ? instance.current.value : undefined,
          {
            error: instance.current?.kind === 'error' ? instance.current.error : undefined,
            isLoading: !!instance.inProgress,
          },
          instance
        ),
      { runNow, throttle }
    );
  }

  private updateInstance(arg: Arg, update: (value: Draft<Instance<Arg, Value>>) => void): Instance<Arg, Value> {
    const key = hash(arg);
    this.cache.update((state) => {
      let instance = state.get(key);
      if (!instance) {
        instance = { arg: arg as Draft<Arg> };
        state.set(key, instance);
      }
      update(instance);
    });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.cache.getState().get(key)!;
  }
}
