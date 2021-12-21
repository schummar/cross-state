import { castDraft, Draft, enableMapSet } from 'immer';
import { hash } from '../helpers/hash';
import { Cancel } from '../helpers/misc';
import { Store, StoreSubscribeOptions } from '../store';
import { globalResouceGroup, ResourceGroup } from './resourceGroup';

type CacheEntry<Arg, Value> = {
  readonly arg: Arg;
  current?:
    | {
        kind: 'value';
        value: Value;
      }
    | {
        kind: 'error';
        error: unknown;
      };
  future?: Promise<Value>;
  connectionState?: 'connected' | 'disconnected';
  stale?: true;
  tInvalidate?: number;
  tClear?: number;
};

export type ResourceState<Value> = {
  value?: Value;
  error?: unknown;
  isLoading?: boolean;
  stale?: boolean;
};

export type ResourceOptions<Value> = {
  invalidateAfter?: number | ((state: ResourceState<Value>) => number | undefined);
  clearAfter?: number | ((state: ResourceState<Value>) => number | undefined);
  resourceGroup?: ResourceGroup | ResourceGroup[];
};

export type ResourceSubscribeOptions = StoreSubscribeOptions & {
  watchOnly?: boolean;
};

export abstract class Resource<Arg, Value> {
  static options: ResourceOptions<unknown> = {};

  id = Math.random().toString(36);
  cache = new Store(new Map<string, CacheEntry<Arg, Value>>());
  cleanTimer?: ReturnType<typeof setTimeout>;

  protected constructor(public readonly options: ResourceOptions<Value>) {
    let { resourceGroup = [] } = options;

    enableMapSet();
    this.start();

    if (!(resourceGroup instanceof Array)) {
      resourceGroup = [resourceGroup];
    }
    for (const r of resourceGroup.concat(globalResouceGroup)) {
      r.resources.add(this);
    }
  }

  abstract instance(arg: Arg): ResourceInstance<Arg, Value>;

  invalidateCacheAll(): void {
    for (const { arg } of this.cache.getState().values()) {
      this.instance(arg).invalidateCache();
    }
  }

  clearCacheAll(): void {
    for (const { arg } of this.cache.getState().values()) {
      this.instance(arg).clearCache();
    }
  }

  protected start() {
    this.cache.subscribe(
      () => this.calculateNextClean(),
      (min) => this.scheduleClean(min)
    );
  }

  protected calculateNextClean() {
    return Math.min(
      ...[...this.cache.getState().values()].map((entry) => Math.min(entry.tInvalidate ?? Infinity, entry.tClear ?? Infinity))
    );
  }

  protected scheduleClean(next = this.calculateNextClean()) {
    if (this.cleanTimer) {
      clearTimeout(this.cleanTimer);
    }

    if (next && next !== Infinity) {
      this.cleanTimer = setTimeout(() => this.clean(), next - Date.now());
    }
  }

  protected clean() {
    const now = Date.now();

    for (const { arg, tInvalidate, tClear } of this.cache.getState().values()) {
      if (tClear && tClear <= now) {
        this.instance(arg).clearCache();
      } else if (tInvalidate && tInvalidate <= now) {
        this.instance(arg).invalidateCache();
      }
    }
  }
}

export abstract class ResourceInstance<Arg, Value> {
  constructor(
    //
    public readonly resource: Resource<Arg, Value>,
    public readonly arg: Arg
  ) {}

  readonly key = hash(this.arg);
  readonly id = `${this.resource.id}:${this.key}`;
  protected cache = this.resource.cache;

  getCache(): ResourceState<Value> {
    const entry = this.cache.getState().get(this.key);
    return {
      value: entry?.current?.kind === 'value' ? entry.current.value : undefined,
      error: entry?.current?.kind === 'error' ? entry.current.error : undefined,
      isLoading: !!entry?.future,
      stale: !!entry?.stale,
    };
  }

  unsafe_getRawCache(): CacheEntry<Arg, Value> | undefined {
    return this.cache.getState().get(this.key);
  }

  invalidateCache(): void {
    this.updateCache((entry) => {
      entry.stale = true;
      delete entry.tInvalidate;
    }, false);
  }

  clearCache(): void {
    this.cache.update((state) => {
      state.delete(this.key);
    });
  }

  protected updateCache(update: (value: Draft<CacheEntry<Arg, Value>>) => void, create = true): void {
    this.cache.update((state) => {
      let entry = state.get(this.key);
      if (!entry && create) {
        entry = { arg: castDraft(this.arg) };
        state.set(this.key, entry);
      }
      if (entry) {
        update(entry);
      }
    });
  }

  abstract subscribe(listener: (state: ResourceState<Value>) => void, options?: ResourceSubscribeOptions): Cancel;

  protected setValue(value: Value): void {
    this.cache.batchUpdates(() => {
      this.updateCache((entry) => {
        entry.current = {
          kind: 'value',
          value: castDraft(value),
        };
        delete entry.future;
        delete entry.stale;
      });

      this.setTimers();
    });
  }

  protected setError(error: unknown): void {
    this.cache.batchUpdates(() => {
      this.updateCache((entry) => {
        entry.current = {
          kind: 'error',
          error,
        };
        delete entry.future;
        delete entry.stale;
      });

      this.setTimers();
    });
  }

  protected setTimers(): void {
    let { invalidateAfter = Resource.options.invalidateAfter, clearAfter = Resource.options.clearAfter } = this.resource.options;
    const state = this.getCache();
    const now = Date.now();

    this.updateCache((entry) => {
      if (invalidateAfter instanceof Function) {
        invalidateAfter = invalidateAfter(state);
      }
      if (invalidateAfter !== undefined && invalidateAfter !== Infinity) {
        entry.tInvalidate = now + invalidateAfter;
      }

      if (clearAfter instanceof Function) {
        clearAfter = clearAfter(state);
      }
      if (clearAfter !== undefined && clearAfter !== Infinity) {
        entry.tClear = now + clearAfter;
      }
    });
  }
}
