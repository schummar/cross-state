import { Cache } from '../lib/cache';
import { calcDuration } from '../lib/calcDuration';
import { defaultEquals, simpleShallowEquals } from '../lib/equals';
import { atomicStore } from './atomicStore';
import { once } from './once';
import type { Resource, ResourceGroup } from './resourceGroup';
import { allResources } from './resourceGroup';
import type { Cancel, Duration, Effect, Listener, Store, SubscribeOptions } from './types';

///////////////////////////////////////////////////////////
// Types
///////////////////////////////////////////////////////////

type WithValue<T> = { value: T; error: undefined; isPending: boolean; isStale: boolean; status: 'value' };
type WithError = { value: undefined; error: unknown; isPending: boolean; isStale: boolean; status: 'error' };
type Empty = { value: undefined; error: undefined; isPending: boolean; isStale: boolean; status: 'empty' };
type State<T> = WithValue<T> | WithError | Empty;

export type AsyncStoreValue<T> =
  | ([value: T, error: undefined, isPending: boolean, isStale: boolean, status: 'value'] & WithValue<T>)
  | ([value: undefined, error: unknown, isPending: boolean, isStale: boolean, status: 'error'] & WithError)
  | ([value: undefined, error: undefined, isPending: boolean, isStale: boolean, status: 'empty'] & Empty);

export type AsyncStoreOptions<Value> = {
  invalidateAfter?: Duration | ((state: AsyncStoreValue<Value>) => Duration);
  clearAfter?: Duration | ((state: AsyncStoreValue<Value>) => Duration);
  clearUnusedAfter?: Duration;
  resourceGroup?: ResourceGroup | ResourceGroup[];
};

export interface AsyncCollection<Value, Args extends any[]> extends Resource {
  (...args: Args): AsyncStore<Value, Args>;
}

export interface AsyncAction<Value, Args extends any[]> {
  (this: { use: <T>(store: Store<T>) => T }, ...args: Args): Value | Promise<Value>;
}

export type AsyncStore<Value, Args extends any[]> = AsyncStoreImpl<Value, Args>;

///////////////////////////////////////////////////////////
// Helpers
///////////////////////////////////////////////////////////

export const asyncStoreValueEquals = <Value>(
  [va, ...a]: AsyncStoreValue<Value>,
  [vb, ...b]: AsyncStoreValue<Value>,
  equals = defaultEquals
) => {
  return equals(va, vb) && simpleShallowEquals(a, b);
};

export const createState = <Value>(x: Partial<State<Value>> = {}): AsyncStoreValue<Value> => {
  const state = {
    value: x.value,
    error: x.error,
    isPending: x.isPending ?? false,
    isStale: x.isStale ?? false,
    status: x.status ?? 'empty',
  } as any;

  return Object.assign(Object.values(state), state);
};

///////////////////////////////////////////////////////////
// Global
///////////////////////////////////////////////////////////

let defaultOptions: AsyncStoreOptions<any> = {
  invalidateAfter: undefined as Duration | undefined,
  clearAfter: undefined as Duration | undefined,
  clearUnusedAfter: { days: 1 },
};

function setDefaultOptions(options: typeof defaultOptions) {
  defaultOptions = options;
}

///////////////////////////////////////////////////////////
// Implementation
///////////////////////////////////////////////////////////

class AsyncStoreImpl<Value, Args extends any[]> implements Store<AsyncStoreValue<Value>> {
  private args: Args;
  private invalidateTimer?: ReturnType<typeof setTimeout>;
  private clearTimer?: ReturnType<typeof setTimeout>;
  private cancelRun?: Cancel;
  private internalStore = atomicStore(createState<Value>());

  constructor(private readonly fn: AsyncAction<Value, Args>, private readonly options: AsyncStoreOptions<Value>, ...args: Args) {
    this.args = args;

    this.internalStore.addEffect(() => {
      if ((this.internalStore.get().status === 'empty' || this.internalStore.get().isStale) && !this.internalStore.get().isPending) {
        this.run();
      }
    });

    this.get = this.get.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.addEffect = this.addEffect.bind(this);
    this.isActive = this.isActive.bind(this);
    this.recreate = this.recreate.bind(this);
    this.getPromise = this.getPromise.bind(this);
    this.set = this.set.bind(this);
    this.setError = this.setError.bind(this);
    this.invalidate = this.invalidate.bind(this);
    this.clear = this.clear.bind(this);
  }

  get() {
    return this.internalStore.get();
  }

  subscribe(listener: Listener<AsyncStoreValue<Value>>, options?: SubscribeOptions): Cancel;
  subscribe<S>(listener: Listener<S>, selector: (value: AsyncStoreValue<Value>) => S, options?: SubscribeOptions): Cancel;
  subscribe<S>(
    listener: Listener<S>,
    ...[arg1, arg2]: [options?: SubscribeOptions] | [selector: (value: AsyncStoreValue<Value>) => S, options?: SubscribeOptions]
  ) {
    const selector: (value: AsyncStoreValue<Value>) => S = arg1 instanceof Function ? arg1 : (value) => value as any;
    const options = arg1 instanceof Function ? arg2 : arg1;

    return this.internalStore.subscribe(listener, selector, {
      ...options,
      equals: (a, b) => asyncStoreValueEquals(a, b, options?.equals),
    });
  }

  addEffect(effect: Effect, retain?: Duration | undefined) {
    return this.internalStore.addEffect(effect, retain);
  }

  isActive() {
    return this.internalStore.isActive();
  }

  recreate(): this {
    return new AsyncStoreImpl(this.fn, this.options, ...this.args) as this;
  }

  async getPromise({ returnStale }: { returnStale?: boolean } = {}) {
    const state = await once(
      this,
      (state): state is AsyncStoreValue<Value> & { status: 'value' | 'error' } =>
        (returnStale || !state.isStale) && (state.status === 'value' || state.status === 'error')
    );
    if (state.status === 'value') {
      return state.value;
    }
    throw state.error;
  }

  set(value: Value | ((value?: Value) => Value)) {
    if (value instanceof Function) {
      value = value(this.get().value);
    }
    this.cancelRun?.();
    this.internalStore.set(createState({ value, status: 'value' }));
    this.setTimers();
  }

  setError(error: unknown) {
    this.cancelRun?.();
    this.internalStore.set(createState({ error, status: 'error' }));
    this.setTimers();
  }

  invalidate() {
    this.cancelRun?.();
    this.internalStore.set((s) => createState({ ...s, isPending: this.internalStore.isActive(), isStale: s.status !== 'empty' }));
    if (this.internalStore.isActive()) {
      this.run();
    }
  }

  clear() {
    this.cancelRun?.();
    this.internalStore.set(createState({ isPending: this.internalStore.isActive() }));
    if (this.internalStore.isActive()) {
      this.run();
    }
  }

  private async run() {
    this.resetTimers();

    const deps = new Map<Store<any>, Cancel>();
    let isCanceled = false;

    this.cancelRun = () => {
      for (const handle of deps.values()) {
        handle();
      }

      isCanceled = true;
    };

    try {
      const job = this.fn.apply(
        {
          use: (store) => {
            if (!deps.has(store)) {
              deps.set(store, store.subscribe(this.clear, { runNow: false }));
            }
            return store.get();
          },
        },
        this.args
      );

      this.internalStore.set((s) => createState({ ...s, isPending: true }));
      const value = await job;

      if (!isCanceled) {
        this.internalStore.set(createState({ value, status: 'value' }));
        this.setTimers();
      }
    } catch (error) {
      if (!isCanceled) {
        this.internalStore.set(createState({ error, status: 'error' }));
      }
    }
  }

  private setTimers() {
    this.resetTimers();

    let { invalidateAfter = defaultOptions.invalidateAfter, clearAfter = defaultOptions.clearAfter } = this.options;

    if (invalidateAfter instanceof Function) {
      invalidateAfter = invalidateAfter(this.get());
    }
    if (invalidateAfter) {
      this.invalidateTimer = setTimeout(this.invalidate, calcDuration(invalidateAfter));
    }

    if (clearAfter instanceof Function) {
      clearAfter = clearAfter(this.get());
    }
    if (clearAfter) {
      this.clearTimer = setTimeout(this.invalidate, calcDuration(clearAfter));
    }
  }

  private resetTimers() {
    this.invalidateTimer !== undefined && clearTimeout(this.invalidateTimer);
    this.clearTimer !== undefined && clearTimeout(this.clearTimer);
  }
}

function getAsyncStore<Value = unknown, Args extends any[] = []>(
  fn: AsyncAction<Value, Args>,
  options: AsyncStoreOptions<Value> = {}
): AsyncCollection<Value, Args> {
  const cache = new Cache(
    (...args: Args) => new AsyncStoreImpl(fn, options, ...args),
    calcDuration(options.clearUnusedAfter ?? defaultOptions.clearUnusedAfter ?? 0)
  );

  const get = (...args: Args) => {
    return cache.get(...args);
  };

  const invalidate = () => {
    for (const instance of cache.values()) {
      instance.invalidate();
    }
  };

  const clear = () => {
    for (const instance of cache.values()) {
      instance.clear();
    }
  };

  const resource = { invalidate, clear };
  const groups = Array.isArray(options.resourceGroup) ? options.resourceGroup : options.resourceGroup ? [options.resourceGroup] : [];
  for (const group of groups.concat(allResources)) {
    group.add(resource);
  }

  return Object.assign(get, resource);
}

export const asyncStore = Object.assign(getAsyncStore, {
  setDefaultOptions,
});
