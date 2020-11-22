import { Draft, enableMapSet, PatchListener } from 'immer';
import hash from 'object-hash';
import retry from './retry';
import { Store } from './store';

enableMapSet();

type Val<Value> = { value: Value };
type Instance<Arg, Value> = { arg: Arg; result?: Val<Value>; error?: unknown; loading?: Promise<Value>; t?: Date; stale?: boolean };

export class Action<Arg, Value> {
  private cache = new Store<Map<string, Instance<Arg, Value>>>(new Map());

  constructor(private action: (arg: Arg) => Promise<Value>) {}

  getCached(arg: Arg) {
    const key = hash(arg);
    const instance = this.cache.getState().get(key);
    return instance?.result?.value;
  }

  setCached(arg: Arg, value: Value) {
    this.updateInstance(arg, (instance) => {
      instance.result = { value: value as Draft<Value> };
      instance.t = new Date();
    });
  }

  updateCached(arg: Arg, update: (draft: Draft<Value>) => void, listener?: PatchListener) {
    this.updateInstance(
      arg,
      (instance) => {
        if (!instance.result) throw Error(`Can't update non existing value.`);
        update(instance.result.value);
      },
      listener
    );
  }

  updateAllCached(update: (draft: Draft<Value>, arg: Arg) => void, listener?: PatchListener) {
    for (const { arg } of this.cache.getState().values()) {
      this.updateCached(arg, (draft) => update(draft, arg), listener);
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
    if (this.cache.getState().get(key)?.loading) {
      return this.cache.getState().get(key)?.loading;
    }

    const loading = retry(() => this.action(arg), tries);

    this.updateInstance(arg, (instance) => {
      instance.loading = loading;
    });

    try {
      const value = await loading;
      this.updateInstance(arg, (instance) => {
        instance.result = { value: value as Draft<Value> };
        delete instance.error;
        instance.t = new Date();
        delete instance.loading;
      });
      return value;
    } catch (e) {
      this.updateInstance(arg, (instance) => {
        delete instance.result;
        instance.error = e;
        instance.t = new Date();
        delete instance.loading;
      });
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
