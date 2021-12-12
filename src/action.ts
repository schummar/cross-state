import { castDraft, Draft, enableMapSet } from 'immer';
import { hash } from './helpers/hash';
import { Cancel } from './helpers/misc';
import retry from './helpers/retry';
import { Store } from './store';

export type CacheEntry<Arg, Value> = {
  readonly arg: Arg;
  current?: (
    | {
        kind: 'value';
        value: Value;
      }
    | {
        kind: 'error';
        error: unknown;
      }
  ) & {
    stale?: true;
  };
  future?: Promise<Value>;
  tInvalidate?: number;
  tClear?: number;
};

export type ActionImplemenation<Arg, Value> = (arg: Arg) => Promise<Value>;

export type ActionOptions<Value> = {
  invalidateAfter?: number | ((value: Value | undefined, error: unknown | undefined) => number | undefined);
  clearAfter?: number | ((value: Value | undefined, error: unknown | undefined) => number | undefined);
};

export type Action<Arg, Value> = {
  (...args: Arg extends undefined ? [arg?: Arg] : [arg: Arg]): ActionInstance<Arg, Value>;
  invalidateAll(): void;
  clearAll(): void;
};

const allActions = new Array<Action<any, any>>();

export function invalidateAllActions() {
  for (const action of allActions) {
    action.invalidateAll();
  }
}

export function clearAllAction() {
  for (const action of allActions) {
    action.clearAll();
  }
}

export class ActionInstance<Arg, Value> {
  constructor(
    protected readonly cache: Store<Map<string, CacheEntry<Arg, Value>>>,
    protected readonly implementation: ActionImplemenation<Arg, Value>,
    protected readonly options: ActionOptions<Value>,
    public readonly arg: Arg
  ) {}

  readonly key = hash(this.arg);

  getCache(): CacheEntry<Arg, Value> | undefined {
    return this.cache.getState().get(this.key);
  }

  invalidateCache(): void {
    this.updateCache((entry) => {
      if (entry.current) {
        entry.current.stale = true;
      }
      delete entry.tInvalidate;
    }, false);
  }

  clearCache(): void {
    this.cache.update((state) => {
      state.delete(this.key);
    });
  }

  update(update: Value | ((value?: Value, error?: unknown) => Value), invalidate?: boolean | Promise<Value>): void {
    if (update instanceof Function) {
      const entry = this.getCache();
      const value = entry?.current?.kind === 'value' ? entry.current.value : undefined;
      const error = entry?.current?.kind === 'error' ? entry.current.error : undefined;
      update = update(value, error);
    }
    this.setValue(update);

    if (invalidate) {
      this.invalidateCache();
    }
    if (invalidate instanceof Promise) {
      this.setFuture(invalidate);
    }
  }

  async get({ allowStale = false, retries = 0 } = {}): Promise<Value> {
    const entry = this.getCache();

    if (entry?.current && (!entry.current.stale || allowStale)) {
      if (entry.current.kind === 'value') return entry.current.value;
      else throw entry.current.error;
    }

    if (entry?.future) {
      return entry.future;
    }

    return this.execute({ retries });
  }

  async execute({ retries = 0 } = {}): Promise<Value> {
    const task = retry(() => this.implementation(this.arg), retries);
    this.setFuture(task);
    return task;
  }

  subscribe(
    listener: (state: { value?: Value; error?: unknown; stale?: true; isLoading: boolean }) => void,
    options?: Parameters<Store<any>['subscribe']>[2]
  ): Cancel {
    return this.cache.subscribe(
      (state) => state.get(this.key) ?? { arg: this.arg },
      (instance) =>
        listener({
          value: instance.current?.kind === 'value' ? instance.current.value : undefined,
          error: instance.current?.kind === 'error' ? instance.current.error : undefined,
          stale: instance.current?.stale,
          isLoading: !!instance.future,
        }),
      options
    );
  }

  private setValue(value: Value): void {
    this.updateCache((entry) => {
      entry.current = {
        kind: 'value',
        value: castDraft(value),
      };
      delete entry.future;
    });
    this.setTimers();
  }

  private setError(error: unknown): void {
    this.updateCache((entry) => {
      entry.current = {
        kind: 'error',
        error,
      };
      delete entry.future;
    });
    this.setTimers();
  }

  private async setFuture(future: Promise<Value>) {
    this.updateCache((entry) => {
      entry.future = future;
    });

    try {
      const value = await future;
      if (this.getCache()?.future === future) {
        this.setValue(value);
      }
    } catch (e) {
      if (this.getCache()?.future === future) {
        this.setError(e);
      }
    }
  }

  private updateCache(update: (value: Draft<CacheEntry<Arg, Value>>) => void, create = true): void {
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

  private setTimers(): void {
    let { invalidateAfter, clearAfter } = this.options;
    const entry = this.getCache();
    const value = entry?.current?.kind === 'value' ? entry.current.value : undefined;
    const error = entry?.current?.kind === 'error' ? entry.current.error : undefined;
    const now = Date.now();

    this.updateCache((entry) => {
      if (invalidateAfter instanceof Function) {
        invalidateAfter = invalidateAfter(value, error);
      }
      if (invalidateAfter !== undefined && invalidateAfter !== Infinity) {
        entry.tInvalidate = now + invalidateAfter;
      }

      if (clearAfter instanceof Function) {
        clearAfter = clearAfter(value, error);
      }
      if (clearAfter !== undefined && clearAfter !== Infinity) {
        entry.tClear = now + clearAfter;
      }
    });
  }
}

export function createAction<Arg = undefined, Value = unknown>(
  implementation: ActionImplemenation<Arg, Value>,
  options: ActionOptions<Value> = {}
) {
  enableMapSet();
  const cache = new Store(new Map<string, CacheEntry<Arg, Value>>());

  function createInstance(arg?: Arg) {
    return new ActionInstance<Arg, Value>(cache, implementation, options, arg as Arg);
  }

  function clean() {
    const now = Date.now();

    for (const { arg, tInvalidate, tClear } of cache.getState().values()) {
      if (tClear && tClear <= now) {
        createInstance(arg).clearCache();
      } else if (tInvalidate && tInvalidate <= now) {
        createInstance(arg).invalidateCache();
      }
    }
  }

  let timer: NodeJS.Timeout | undefined;
  cache.subscribe(
    (state) => [...state.values()].reduce((min, entry) => Math.min(min, entry.tInvalidate ?? Infinity, entry.tClear ?? Infinity), 0),
    (min) => {
      if (timer) clearTimeout(timer);
      if (min) {
        timer = setTimeout(clean, min);
      }
    }
  );

  const action: Action<Arg, Value> = Object.assign(createInstance, {
    invalidateAll(): void {
      for (const { arg } of cache.getState().values()) {
        createInstance(...([arg] as Parameters<typeof createInstance>)).invalidateCache();
      }
    },

    clearAll(): void {
      for (const { arg } of cache.getState().values()) {
        createInstance(...([arg] as Parameters<typeof createInstance>)).clearCache();
      }
    },
  });

  allActions.push(action);
  return action;
}
