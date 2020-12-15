import fastDeepEqual from 'fast-deep-equal';
import objectHash from 'object-hash';
import { BaseStore } from './baseStore';
import { Cancel } from './misc';
import retry from './retry';

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

  private cache = new BaseStore(new Map<string, Instance<Arg, Value>>(), {
    equals: fastDeepEqual,
    update: (state, update: (state: Map<string, Instance<Arg, Value>>) => Map<string, Instance<Arg, Value>>) => update(state),
  });

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
    this.updateInstance(arg, () => ({ current: { kind: 'value', value, t: new Date() } }));
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

  async run(arg: Arg, { update = false, clearBeforeUpdate = false, tries = 3 } = {}): Promise<Value> {
    const key = hash(arg);

    const fromCache = this.cache.getState().get(key);

    if (fromCache?.current && !update) {
      if (fromCache.current.kind === 'value') return fromCache.current.value;
      else throw fromCache.current.error;
    }

    if (fromCache?.inProgress) {
      return fromCache.inProgress;
    }

    const task = retry(() => this.action(arg), tries);

    this.updateInstance(arg, (instance) => ({
      current: clearBeforeUpdate ? undefined : instance.current,
      inProgress: task,
    }));

    try {
      const value = await task;

      if (task === this.cache.getState().get(key)?.inProgress) {
        this.setCache(arg, value);
      }

      return value;
    } catch (e) {
      if (task === this.cache.getState().get(key)?.inProgress) {
        this.updateInstance(arg, () => ({
          current: { kind: 'error', error: e, t: new Date() },
          inProgress: undefined,
        }));
      }

      throw e;
    }
  }

  subscribe(arg: Arg, listener: (instance: Instance<Arg, Value>) => void, { emitNow = false } = {}): Cancel {
    const key = hash(arg);
    return this.cache.subscribe((state) => state.get(key) ?? { arg }, listener, emitNow);
  }

  private updateInstance(arg: Arg, update: (value: Instance<Arg, Value>) => Partial<Instance<Arg, Value>>): void {
    const key = hash(arg);
    this.cache.update((state) => {
      const instance = state.get(key) ?? { arg };
      return state.set(key, { ...instance, ...update(instance) });
    });
  }
}
