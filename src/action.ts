import { Draft, enableMapSet } from 'immer';
import objectHash from 'object-hash';
import { Cancel } from './misc';
import retry from './retry';
import { Store } from './store';
import type { UseActionOptions } from './useAction';

enableMapSet();

function hash(x: unknown) {
  return objectHash(x ?? null);
}

type Result<Value> = { kind: 'value'; value: Value; t: Date } | { kind: 'error'; error: unknown; t: Date };
type Instance<Arg, Value> = {
  arg: Arg;
  current?: Result<Value>;
  inProgress?: Promise<Value>;
  invalid?: boolean;
  timer?: NodeJS.Timeout;
};

export class Action<Arg, Value> {
  static allActions = new Array<Action<any, any>>();

  static clearCacheAll(): void {
    for (const action of Action.allActions) {
      action.clearCacheAll();
    }
  }

  private cache = new Store(new Map<string, Instance<Arg, Value>>());

  constructor(private action: (arg: Arg) => Promise<Value>, private options: { invalidateAfter?: number }) {
    Action.allActions.push(this);
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

      this.scheduleInvalidation(instance);
    });
  }

  updateCache(arg: Arg, update: (draft: Draft<Value>) => void): boolean {
    let found = false;

    this.updateInstance(arg, (instance) => {
      if (instance.current?.kind === 'value') {
        update(instance.current.value);
        this.scheduleInvalidation(instance);
        found = true;
      }
    });

    return found;
  }

  updateCacheAll(update: (draft: Draft<Value>, arg: Arg) => void): void {
    this.cache.update((state) => {
      for (const instance of state.values()) {
        const { arg, current } = instance;
        if (current?.kind === 'value') {
          update(current.value, arg as Arg);
          this.scheduleInvalidation(instance);
        }
      }
    });
  }

  clearCache(arg: Arg): void {
    const key = hash(arg);
    this.cache.update((state) => {
      const instance = state.get(key);
      if (instance?.timer) {
        clearTimeout(instance.timer as NodeJS.Timeout);
      }

      state.delete(key);
      return state;
    });
  }

  clearCacheAll(): void {
    this.cache.update((state) => {
      for (const { arg } of state.values()) {
        this.clearCache(arg as Arg);
      }
    });
  }

  async get(arg: Arg, { clearBeforeUpdate = false, retries = 0 } = {}): Promise<Value> {
    const key = hash(arg);
    const fromCache = this.cache.getState().get(key);

    if (fromCache?.current && !fromCache.invalid) {
      if (fromCache.current.kind === 'value') return fromCache.current.value;
      else throw fromCache.current.error;
    }

    return this.execute(arg, { clearBeforeUpdate, retries });
  }

  async execute(arg: Arg, { clearBeforeUpdate = false, retries = 0 } = {}): Promise<Value> {
    const key = hash(arg);

    const fromCache = this.cache.getState().get(key);

    if (fromCache?.inProgress) {
      return fromCache.inProgress;
    }

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
          this.scheduleInvalidation(instance);
        });
      }

      throw e;
    }
  }

  scheduleInvalidation(instance: Draft<Instance<Arg, Value>>): void {
    if (instance.timer) {
      clearTimeout(instance.timer as NodeJS.Timeout);
      delete instance.timer;
    }

    if (this.options.invalidateAfter !== undefined && this.options.invalidateAfter !== Infinity) {
      instance.timer = setTimeout(() => {
        this.updateInstance(instance.arg as Arg, (instance) => {
          instance.invalid = true;
          delete instance.timer;
        });
      }, this.options.invalidateAfter);
    }
  }

  subscribe(arg: Arg, listener: (instance: Instance<Arg, Value>) => void, { runNow = false } = {}): Cancel {
    const key = hash(arg);
    return this.cache.subscribe((state) => state.get(key) ?? { arg }, listener, { runNow });
  }

  private updateInstance(arg: Arg, update: (value: Draft<Instance<Arg, Value>>) => void): void {
    const key = hash(arg);
    this.cache.update((state) => {
      let instance = state.get(key);
      if (!instance) {
        instance = { arg: arg as Draft<Arg> };
        state.set(key, instance);
      }
      update(instance);
    });
  }

  useAction(arg: Arg, options: UseActionOptions = {}): [Value | undefined, { error?: unknown; isLoading: boolean }] {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('./useAction').useAction(this, arg, options);
  }
}
