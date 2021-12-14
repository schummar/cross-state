import { castDraft, Draft, enableMapSet } from 'immer';
import { hash } from './helpers/hash';
import { Cancel } from './helpers/misc';
import retry from './helpers/retry';
import { Store } from './store';

export type CacheEntry<Arg, Value> = {
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

export type ResourceImplemenation<Arg, Value> = (arg: Arg) => Promise<Value>;

export type ResourceOptions<Value> = {
  invalidateAfter?: number | ((state: ResourceState<Value>) => number | undefined);
  clearAfter?: number | ((state: ResourceState<Value>) => number | undefined);
};

export class Resource<Arg, Value> {
  static allResources = new Array<Resource<any, any>>();

  static create<Arg = undefined, Value = unknown>(
    implementation: ResourceImplemenation<Arg, Value>,
    options?: ResourceOptions<Value>
  ): Resource<Arg, Value> & { (...args: Arg extends undefined ? [arg?: Arg] : [arg: Arg]): ResourceInstance<Arg, Value> } {
    const resource = new Resource(implementation, options);

    return new Proxy<any>(
      function (...[arg]: Arg extends undefined ? [arg?: Arg] : [arg: Arg]) {
        return resource.run(arg as Arg);
      },
      {
        get(_target, prop) {
          return resource[prop as keyof Resource<Arg, Value>];
        },
      }
    );
  }

  static invalidateCacheAll() {
    for (const resource of Resource.allResources) {
      resource.invalidateCacheAll();
    }
  }

  static clearCacheAll() {
    for (const resource of Resource.allResources) {
      resource.clearCacheAll();
    }
  }

  static options: ResourceOptions<unknown> = {};

  id = Math.random().toString(36);
  cache = new Store(new Map<string, CacheEntry<Arg, Value>>());
  cleanTimer?: NodeJS.Timeout;

  protected constructor(
    //
    public readonly implementation: ResourceImplemenation<Arg, Value>,
    public readonly options: ResourceOptions<Value> = {}
  ) {
    enableMapSet();
    Resource.allResources.push(this);
    this.start();
  }

  run(arg: Arg): ResourceInstance<Arg, Value> {
    return new ResourceInstance(this, arg);
  }

  invalidateCacheAll(): void {
    for (const { arg } of this.cache.getState().values()) {
      this.run(arg).invalidateCache();
    }
  }

  clearCacheAll(): void {
    for (const { arg } of this.cache.getState().values()) {
      this.run(arg).clearCache();
    }
  }

  protected start() {
    this.cache.subscribe(
      () => this.calculateNextClean(),
      (min) => this.scheduleClean(min)
    );
  }

  protected calculateNextClean() {
    return Math.min(...[...this.cache.getState().values()].flatMap((entry) => [entry.tInvalidate ?? Infinity, entry.tClear ?? Infinity]));
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
        this.run(arg).clearCache();
      } else if (tInvalidate && tInvalidate <= now) {
        this.run(arg).invalidateCache();
      }
    }
  }
}

export class ResourceInstance<Arg, Value> {
  constructor(public readonly resource: Resource<Arg, Value>, public readonly arg: Arg) {}

  readonly key = hash(this.arg);
  readonly id = `${this.resource.id}:${this.key}`;
  protected cache = this.resource.cache;
  protected implementation = this.resource.implementation;
  protected options = this.resource.options;

  getCache(): ResourceState<Value> | undefined {
    const entry = this.cache.getState().get(this.key);
    return (
      entry && {
        value: entry.current?.kind === 'value' ? entry.current.value : undefined,
        error: entry.current?.kind === 'error' ? entry.current.error : undefined,
        isLoading: !!entry.future,
        stale: !!entry.stale,
      }
    );
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

  update(update: Value | ((state: ResourceState<Value>) => Value), invalidate?: boolean | Promise<Value>): void {
    if (update instanceof Function) {
      update = update(this.getCache() ?? {});
    }
    this.setValue(update);

    if (invalidate) {
      this.invalidateCache();
    }
    if (invalidate instanceof Promise) {
      this.setFuture(invalidate);
    }
  }

  async get({ returnStale = false, updateStale = true, forceUpdate = false, retries = 0 } = {}): Promise<Value> {
    const { current, future, stale } = this.cache.getState().get(this.key) ?? {};

    const update = () => {
      const promise = retry(() => this.implementation(this.arg), retries);
      this.setFuture(promise);
      return promise;
    };

    if (current && (!stale || returnStale)) {
      if ((stale && updateStale && !future) || forceUpdate) {
        update();
      }

      if (current.kind === 'value') return current.value;
      throw current.error;
    } else if (future) {
      if (forceUpdate) {
        update();
      }

      return future;
    } else {
      return update();
    }
  }

  subscribe(listener: (state: ResourceState<Value>) => void, options?: Parameters<Store<any>['subscribe']>[2]): Cancel {
    return this.cache.subscribe(() => this.getCache() ?? {}, listener, options);
  }

  protected setValue(value: Value): void {
    this.updateCache((entry) => {
      entry.current = {
        kind: 'value',
        value: castDraft(value),
      };
      delete entry.future;
      delete entry.stale;
    });
    this.setTimers();
  }

  protected setError(error: unknown): void {
    this.updateCache((entry) => {
      entry.current = {
        kind: 'error',
        error,
      };
      delete entry.future;
      delete entry.stale;
    });
    this.setTimers();
  }

  protected async setFuture(future: Promise<Value>) {
    this.updateCache((entry) => {
      entry.future = future;
    });

    try {
      const value = await future;
      if (this.cache.getState().get(this.key)?.future === future) {
        this.setValue(value);
      }
    } catch (e) {
      if (this.cache.getState().get(this.key)?.future === future) {
        this.setError(e);
      }
    }
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

  protected setTimers(): void {
    let { invalidateAfter = Resource.options.invalidateAfter, clearAfter = Resource.options.clearAfter } = this.options;
    const state = this.getCache();
    const now = Date.now();

    this.updateCache((entry) => {
      if (invalidateAfter instanceof Function) {
        invalidateAfter = invalidateAfter(state ?? {});
      }
      if (invalidateAfter !== undefined && invalidateAfter !== Infinity) {
        entry.tInvalidate = now + invalidateAfter;
      }

      if (clearAfter instanceof Function) {
        clearAfter = clearAfter(state ?? {});
      }
      if (clearAfter !== undefined && clearAfter !== Infinity) {
        entry.tClear = now + clearAfter;
      }
    });
  }
}
