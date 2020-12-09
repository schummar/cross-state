import { Draft, enableMapSet, PatchListener } from 'immer';
import hash from 'object-hash';
import retry from './retry';
import { Store } from './store';

enableMapSet();

type Result<Value> = { kind: 'value'; value: Value; t: Date } | { kind: 'error'; error: unknown; t: Date };
type Instance<Arg, Value> = {
  arg: Arg;
  current?: Result<Value>;
  inProgress?: Promise<Value>;
};

export class Action<Arg, Value> {
  private cache = new Store<Map<string, Instance<Arg, Value>>>(new Map());

  constructor(private action: (arg: Arg) => Promise<Value>) {}

  getCached(arg: Arg) {
    const key = hash(arg);
    return this.cache.getState().get(key);
  }

  getCachedValue(arg: Arg) {
    const instance = this.getCached(arg);
    return instance?.current?.kind === 'value' ? instance.current.value : undefined;
  }

  getCacheError(arg: Arg) {
    const instance = this.getCached(arg);
    return instance?.current?.kind === 'error' ? instance.current.error : undefined;
  }

  setCached(arg: Arg, value: Value) {
    this.updateInstance(arg, (instance) => {
      instance.current = { kind: 'value', value: value as Draft<Value>, t: new Date() };
      delete instance.inProgress;
    });
  }

  updateCached(arg: Arg, update: (value?: Value) => Value) {
    const current = this.getCached(arg)?.current;
    const value = current?.kind === 'value' ? current.value : undefined;
    const newValue = update(value);
    this.setCached(arg, newValue);
  }

  updateAllCached(update: (value: Value | undefined, arg: Arg) => Value) {
    for (const { arg, current } of this.cache.getState().values()) {
      const value = current?.kind === 'value' ? current.value : undefined;
      const newValue = update(value, arg);
      this.setCached(arg, newValue);
    }
  }

  clearCached(arg: Arg) {
    const key = hash(arg);
    this.cache.update((state) => {
      state.delete(key);
    });
  }

  clearAllCached() {
    this.cache.update((state) => {
      state.clear();
    });
  }

  async run(arg: Arg, { tries = 3 }: { tries?: number } = {}) {
    const key = hash(arg);
    if (this.cache.getState().get(key)?.inProgress) {
      return this.cache.getState().get(key)?.inProgress;
    }

    const task = retry(() => this.action(arg), tries);

    this.updateInstance(arg, (instance) => {
      instance.inProgress = task;
    });

    try {
      const value = await task;

      if (task === this.cache.getState().get(key)?.inProgress) {
        this.setCached(arg, value);
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

  subscribe(arg: Arg, listener: (instance: Instance<Arg, Value>) => void) {
    const key = hash(arg);
    listener(this.cache.getState().get(key) ?? { arg });
    return this.cache.subscribe((state) => state.get(key) ?? { arg }, listener);
  }

  private updateInstance(arg: Arg, update: (draft: Draft<Instance<Arg, Value>>) => void, listener?: PatchListener) {
    const key = hash(arg);
    this.cache.update((state) => {
      let instance = state.get(key);
      if (!instance) state.set(key, (instance = { arg: arg as Draft<Arg> }));
      update(instance);
    }, listener);
  }
}
