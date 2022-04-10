import { calcTime } from '../lib/calcTime';
import { defaultEquals, shallowEquals } from '../lib/equals';
import { hash } from '../lib/hash';
import { Cancel, Store, Time } from '../types';
import { once } from './once';
import { store } from './store';

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
};

export interface AsyncStore<Value> extends Store<AsyncStoreValue<Value>> {
  type: 'asyncStore';
  getPromise(options?: { returnStale?: boolean }): Promise<Value>;
  set(update: Value | ((value?: Value) => Value)): void;
  setError(error: unknown): void;
  invalidate(): void;
  clear(): void;
}

export interface AsyncCollection<Value, Args extends any[]> {
  (...args: Args): AsyncStore<Value>;
  invalidate(): void;
  clear(): void;
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

let defaultOptions = {
  invalidateAfter: undefined as Time | undefined,
  clearAfter: undefined as Time | undefined,
};

function setDefaultOptions(options: typeof defaultOptions) {
  defaultOptions = options;
}

///////////////////////////////////////////////////////////
// Implementation
///////////////////////////////////////////////////////////

function _asyncStore<Value = unknown, Args extends any[] = []>(
  fn: AsyncAction<Value, Args>,
  options: AsyncStoreOptions<Value> = {}
): AsyncCollection<Value, Args> {
  const collection = new Map<string, AsyncStore<Value>>();

  const invalidate = () => {
    throw Error('Not implemented');
  };

  const clear = () => {
    throw Error('Not implemented');
  };

  const createAsyncStore = (...args: Args) => {
    let invalidateTimer: ReturnType<typeof setTimeout> | undefined;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;

    let cancelRun: Cancel | undefined;
    const s = store(createState<Value>());

    let on = false;
    s.addEffect(() => {
      on = true;

      return () => {
        on = false;
      };
    });

    const asyncStore: AsyncStore<Value> = {
      type: 'asyncStore',

      get: s.get,

      subscribe(listener, options) {
        if ((s.get().status === 'empty' || s.get().isStale) && !s.get().isPending) {
          run();
        }

        return s.subscribe(() => listener(asyncStore.get()), {
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
        s.set(createState({ value, status: 'value' }));
        setTimers();
      },

      setError(error) {
        cancelRun?.();
        s.set(createState({ error, status: 'error' }));
        setTimers();
      },

      invalidate() {
        cancelRun?.();
        s.set((s) => createState({ ...s, isPending: on, isStale: s.status !== 'empty' }));
        if (on) {
          run();
        }
      },

      clear() {
        cancelRun?.();
        s.set(createState({ isPending: on }));
        if (on) {
          run();
        }
      },

      addEffect: s.addEffect,
      get isActive() {
        return s.isActive;
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

        s.set((s) => createState({ ...s, isPending: true }));
        const value = await job;

        if (!isCanceled) {
          s.set(createState({ value, status: 'value' }));
          setTimers();
        }
      } catch (error) {
        if (!isCanceled) {
          s.set(createState({ error, status: 'error' }));
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

  function getAsyncStore(...args: Args) {
    const key = hash(args);
    let asyncStore = collection.get(key);
    if (!asyncStore) {
      asyncStore = createAsyncStore(...args);
      collection.set(key, asyncStore);
    }
    return asyncStore;
  }

  return Object.assign(getAsyncStore, {
    invalidate,
    clear,
  });
}

export const asyncStore = Object.assign(_asyncStore, {
  setDefaultOptions,
});
