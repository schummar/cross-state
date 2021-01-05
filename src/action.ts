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
};

export class Action<Arg, Value> {
  static allActions = new Array<Action<any, any>>();

  static clearAllCached(): void {
    for (const action of Action.allActions) {
      action.clearAllCached();
    }
  }

  private cache = new Store(new Map<string, Instance<Arg, Value>>());

  constructor(private action: (arg: Arg) => Promise<Value>) {
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
    });
  }

  updateCache(arg: Arg, update: (value?: Value) => Value): void {
    this.setCache(arg, update(this.getCacheValue(arg)));
  }

  updateAllCached(update: (value: Value | undefined, arg: Arg) => Value): void {
    for (const { arg, current } of this.cache.getState().values()) {
      this.setCache(arg, update(current?.kind === 'value' ? current.value : undefined, arg));
    }
  }

  clearCached(arg: Arg): void {
    const key = hash(arg);
    this.cache.update((state) => {
      state.delete(key);
      return state;
    });
  }

  clearAllCached(): void {
    this.cache.update(() => {
      return new Map();
    });
  }

  async get(arg: Arg, { clearBeforeUpdate = false, retries = 0 } = {}): Promise<Value> {
    const key = hash(arg);
    const fromCache = this.cache.getState().get(key);

    if (fromCache?.current) {
      if (fromCache.current.kind === 'value') return fromCache.current.value;
      else throw fromCache.current.error;
    }

    return this.update(arg, { clearBeforeUpdate, retries });
  }

  async update(arg: Arg, { clearBeforeUpdate = false, retries = 0 } = {}): Promise<Value> {
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
        });
      }

      throw e;
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
