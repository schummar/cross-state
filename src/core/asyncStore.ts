import { Cache } from '../lib/cache';
import { calcTime } from '../lib/calcTime';
import { defaultEquals, shallowEquals } from '../lib/equals';
import { once } from './once';
import type { Resource, ResourceGroup } from './resourceGroup';
import { allResources } from './resourceGroup';
import { store } from './store';
import type { Cancel, Store, Time } from './types';

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
  invalidateAfter?: Time | ((state: AsyncStoreValue<Value>) => Time);
  clearAfter?: Time | ((state: AsyncStoreValue<Value>) => Time);
  clearUnusedAfter?: Time;
  resourceGroup?: ResourceGroup | ResourceGroup[];
};

export interface AsyncStore<Value> extends Store<AsyncStoreValue<Value>>, Resource {
  type: 'asyncStore';
  getPromise(options?: { returnStale?: boolean }): Promise<Value>;
  set(update: Value | ((value?: Value) => Value)): void;
  setError(error: unknown): void;
}

export interface AsyncCollection<Value, Args extends any[]> extends Resource {
  (...args: Args): AsyncStore<Value>;
}

export interface AsyncAction<Value, Args extends any[]> {
  (this: { use: <T>(store: Store<T>) => T }, ...args: Args): Value | Promise<Value>;
}

///////////////////////////////////////////////////////////
// Helpers
///////////////////////////////////////////////////////////

export const asyncStoreValueEquals = <Value>(
  [va, ...a]: AsyncStoreValue<Value>,
  [vb, ...b]: AsyncStoreValue<Value>,
  equals = defaultEquals
) => {
  return equals(va, vb) && shallowEquals(a, b);
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
  invalidateAfter: undefined as Time | undefined,
  clearAfter: undefined as Time | undefined,
  clearUnusedAfter: { days: 1 },
};

function setDefaultOptions(options: typeof defaultOptions) {
  defaultOptions = options;
}

///////////////////////////////////////////////////////////
// Implementation
///////////////////////////////////////////////////////////

const createAsyncStore = <Value = unknown, Args extends any[] = []>(
  fn: AsyncAction<Value, Args>,
  options: AsyncStoreOptions<Value> = {},
  ...args: Args
) => {
  let invalidateTimer: ReturnType<typeof setTimeout> | undefined;
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  let cancelRun: Cancel | undefined;
  const base = store(createState<Value>());

  base.addEffect(() => {
    if ((base.get().status === 'empty' || base.get().isStale) && !base.get().isPending) {
      run();
    }
  });

  const asyncStore: AsyncStore<Value> = {
    ...base,

    type: 'asyncStore',

    subscribe(listener, options) {
      return base.subscribe(listener, {
        ...options,
        equals: (a, b) => asyncStoreValueEquals(a, b, options?.equals),
      });
    },

    async getPromise({ returnStale } = {}) {
      const state = await once(
        asyncStore,
        (state): state is AsyncStoreValue<Value> & { status: 'value' | 'error' } =>
          (returnStale || !state.isStale) && (state.status === 'value' || state.status === 'error')
      );
      if (state.status === 'value') {
        return state.value;
      }
      throw state.error;
    },

    set(value) {
      if (value instanceof Function) {
        value = value(asyncStore.get().value);
      }
      cancelRun?.();
      base.set(createState({ value, status: 'value' }));
      setTimers();
    },

    setError(error) {
      cancelRun?.();
      base.set(createState({ error, status: 'error' }));
      setTimers();
    },

    invalidate() {
      cancelRun?.();
      base.set((s) => createState({ ...s, isPending: base.isActive(), isStale: s.status !== 'empty' }));
      if (base.isActive()) {
        run();
      }
    },

    clear() {
      cancelRun?.();
      base.set(createState({ isPending: base.isActive() }));
      if (base.isActive()) {
        run();
      }
    },
  };

  async function run() {
    resetTimers();

    const deps = new Map<Store<any>, Cancel>();
    let isCanceled = false;

    cancelRun = () => {
      for (const handle of deps.values()) {
        handle();
      }

      isCanceled = true;
    };

    try {
      const job = fn.apply(
        {
          use(store) {
            if (!deps.has(store)) {
              deps.set(store, store.subscribe(asyncStore.clear, { runNow: false }));
            }
            return store.get();
          },
        },
        args
      );

      base.set((s) => createState({ ...s, isPending: true }));
      const value = await job;

      if (!isCanceled) {
        base.set(createState({ value, status: 'value' }));
        setTimers();
      }
    } catch (error) {
      if (!isCanceled) {
        base.set(createState({ error, status: 'error' }));
      }
    }
  }

  function setTimers() {
    resetTimers();

    let { invalidateAfter = defaultOptions.invalidateAfter, clearAfter = defaultOptions.clearAfter } = options;

    if (invalidateAfter instanceof Function) {
      invalidateAfter = invalidateAfter(asyncStore.get());
    }
    if (invalidateAfter) {
      invalidateTimer = setTimeout(asyncStore.invalidate, calcTime(invalidateAfter));
    }

    if (clearAfter instanceof Function) {
      clearAfter = clearAfter(asyncStore.get());
    }
    if (clearAfter) {
      clearTimer = setTimeout(asyncStore.invalidate, calcTime(clearAfter));
    }
  }

  function resetTimers() {
    invalidateTimer !== undefined && clearTimeout(invalidateTimer);
    clearTimer !== undefined && clearTimeout(clearTimer);
  }

  return asyncStore;
};

function _asyncStore<Value = unknown, Args extends any[] = []>(
  fn: AsyncAction<Value, Args>,
  options: AsyncStoreOptions<Value> = {}
): AsyncCollection<Value, Args> {
  const cache = new Cache(
    (...args: Args) => createAsyncStore(fn, options, ...args),
    calcTime(options.clearUnusedAfter ?? defaultOptions.clearUnusedAfter ?? 0)
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

export const asyncStore = Object.assign(_asyncStore, {
  setDefaultOptions,
});
