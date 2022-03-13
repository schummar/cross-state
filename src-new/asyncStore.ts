import { store } from './atomicStore';
import { Cancel, Store } from './commonTypes';
import { defaultEquals, shallowEquals } from './equals';

type AsyncStoreValueObj<Value> =
  | { value: Value; error: undefined; isPending: boolean; isStale: boolean; status: 'value' }
  | { value: undefined; error: unknown; isPending: boolean; isStale: boolean; status: 'error' }
  | { value: undefined; error: undefined; isPending: boolean; isStale: boolean; status: 'empty' };

export type AsyncStoreValue<Value> = [AsyncStoreValueObj<Value>['value'], AsyncStoreValueObj<Value>['error'], AsyncStoreValueObj<Value>] &
  AsyncStoreValueObj<Value>;

export type AsyncStoreOptions<Value> = {
  invalidateAfter?: number | ((state: AsyncStoreValue<Value>) => number);
  clearAfter?: number | ((state: AsyncStoreValue<Value>) => number);
};

export interface AsyncStore<Value> extends Store<AsyncStoreValue<Value>> {
  getPromise(options?: { returnStale?: boolean }): Promise<Value>;
  set(value: Value): void;
  setError(error: unknown): void;
  invalidate(): void;
  clear(): void;
}

const asyncStoreValueEquals = <Value>(
  { value: va, ...a }: AsyncStoreValueObj<Value>,
  { value: vb, ...b }: AsyncStoreValueObj<Value>,
  equals = defaultEquals
) => {
  return equals(va, vb) && shallowEquals(a, b);
};

const createState = <Value>(x: Partial<AsyncStoreValueObj<Value>> = {}): AsyncStoreValueObj<Value> =>
  ({
    value: x.value,
    error: x.error,
    isPending: x.isPending ?? false,
    isStale: x.isStale ?? false,
    status: 'value' in x ? 'value' : 'error' in x ? 'error' : 'empty',
  } as any);

export function async<Value>(
  fn: (use: <T>(store: Store<T>) => T) => Promise<Value>,
  { invalidateAfter, clearAfter }: AsyncStoreOptions<Value> = {}
): AsyncStore<Value> {
  let handles: Cancel[] = [];
  let invalidateTimer: ReturnType<typeof setTimeout> | undefined;
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  let future: Promise<Value> | undefined;
  const innerStore = store(createState<Value>());

  const asyncStore: AsyncStore<Value> = {
    get() {
      const state = innerStore.get();
      return Object.assign<any, any>([state.value, state.error, state], state);
    },

    subscribe(listener, options) {
      return innerStore.subscribe(
        ({ status, isStale, isPending }) => {
          if ((status === 'empty' || isStale) && !isPending) {
            run();
          } else {
            listener(asyncStore.get());
          }
        },
        {
          ...options,
          equals: (a, b) => asyncStoreValueEquals(a, b, options?.equals),
        }
      );
    },

    getPromise({ returnStale } = {}) {
      return new Promise((resolve, reject) => {
        const cancel = asyncStore.subscribe(({ value, error, isStale, status }) => {
          if (isStale && !returnStale) {
            return;
          }
          if (status === 'value') {
            resolve(value);
            setTimeout(cancel);
          } else if (status === 'error') {
            reject(error);
            setTimeout(cancel);
          }
        });
      });
    },

    set(newValue) {
      future = undefined;
      innerStore.set(createState({ value: newValue }));
      setTimers();
    },

    setError(error) {
      future = undefined;
      innerStore.set(createState({ error }));
      setTimers();
    },

    invalidate() {
      future = undefined;
      innerStore.set((s) => ({ ...s, isStale: s.status !== 'empty' }));
    },

    clear() {
      future = undefined;
      innerStore.set(createState());
    },
  };

  async function run() {
    for (const handle of handles) {
      handle();
    }
    handles = [];
    resetTimers();

    const deps = new Set<Store<any>>();
    let job;
    future = undefined;

    try {
      job = fn((store) => {
        deps.add(store);
        return store.get();
      });

      future = job;
      innerStore.set((s) => ({ ...s, isPending: true }));
      const value = await job;

      if (job === future) {
        asyncStore.set(value);
      }
    } catch (error) {
      if (job === future) {
        asyncStore.setError(error);
      }
    } finally {
      if (job === future) {
        for (const store of deps) {
          handles.push(store.subscribe(asyncStore.clear, { runNow: false }));
        }
      }
    }
  }

  function setTimers() {
    resetTimers();

    if (invalidateAfter instanceof Function) {
      invalidateAfter = invalidateAfter(asyncStore.get());
    }
    if (invalidateAfter) {
      invalidateTimer = setTimeout(asyncStore.invalidate, invalidateAfter);
    }

    if (clearAfter instanceof Function) {
      clearAfter = clearAfter(asyncStore.get());
    }
    if (clearAfter) {
      clearTimer = setTimeout(asyncStore.invalidate, clearAfter);
    }
  }

  function resetTimers() {
    clearTimeout(invalidateTimer);
    clearTimeout(clearTimer);
  }

  return asyncStore;
}
