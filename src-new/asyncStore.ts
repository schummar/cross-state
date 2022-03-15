import { AtomicStoreInternal, store } from './atomicStore';
import { Cancel, Store } from './commonTypes';
import { defaultEquals, shallowEquals } from './equals';

///////////////////////////////////////////////////////////
// Types
///////////////////////////////////////////////////////////

type WithValue<T> = { value: T; error: undefined; isPending: boolean; isStale: boolean; status: 'value' };
type WithError = { value: undefined; error: unknown; isPending: boolean; isStale: boolean; status: 'error' };
type Empty = { value: undefined; error: undefined; isPending: boolean; isStale: boolean; status: 'empty' };
type State<T> = WithValue<T> | WithError | Empty;
type Update<T> = T | ((value: T) => T);
type UpdateFn<T> = (update: Update<T>) => void;

export type AsyncStoreValue<T> =
  | ([value: T, error: undefined, isPending: boolean, isStale: boolean, status: 'value'] & WithValue<T>)
  | ([value: undefined, error: unknown, isPending: boolean, isStale: boolean, status: 'error'] & WithError)
  | ([value: undefined, error: undefined, isPending: boolean, isStale: boolean, status: 'empty'] & Empty);

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

///////////////////////////////////////////////////////////
// Helpers
///////////////////////////////////////////////////////////

const asyncStoreValueEquals = <Value>({ value: va, ...a }: State<Value>, { value: vb, ...b }: State<Value>, equals = defaultEquals) => {
  return equals(va, vb) && shallowEquals(a, b);
};

const createState = <Value>(x: Partial<State<Value>> = {}): State<Value> =>
  ({
    value: x.value,
    error: x.error,
    isPending: x.isPending ?? false,
    isStale: x.isStale ?? false,
    status: 'value' in x ? 'value' : 'error' in x ? 'error' : 'empty',
  } as any);

///////////////////////////////////////////////////////////
// Implementation
///////////////////////////////////////////////////////////

export function async<Value>(
  fn: (use: <T>(store: Store<T>) => T, register: (process: (set: UpdateFn<Value>) => Cancel) => void) => Value | Promise<Value>,
  { invalidateAfter, clearAfter }: AsyncStoreOptions<Value> = {}
): AsyncStore<Value> {
  let invalidateTimer: ReturnType<typeof setTimeout> | undefined;
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  let cancelRun: Cancel | undefined;
  const innerStore = store(createState()) as unknown as AtomicStoreInternal<State<Value>>;

  const asyncStore: AsyncStore<Value> = {
    get() {
      const state = innerStore.get();
      return Object.assign<any, any>([state.value, state.error, state], state);
    },

    subscribe(listener, options) {
      if ((innerStore.get().status === 'empty' || innerStore.get().isStale) && !innerStore.get().isPending) {
        run();
      }

      return innerStore.subscribe(() => listener(asyncStore.get()), {
        ...options,
        equals: (a, b) => asyncStoreValueEquals(a, b, options?.equals),
      });
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

    set(value) {
      cancelRun?.();
      innerStore.set(createState({ value }));
      setTimers();
    },

    setError(error) {
      cancelRun?.();
      innerStore.set(createState({ error }));
      setTimers();
    },

    invalidate() {
      cancelRun?.();
      innerStore.set((s) => ({ ...s, isPending: innerStore.listeners.size > 0, isStale: s.status !== 'empty' }));
      if (innerStore.listeners.size > 0) {
        run();
      }
    },

    clear() {
      cancelRun?.();
      innerStore.set(createState({ isPending: innerStore.listeners.size > 0 }));
      if (innerStore.listeners.size > 0) {
        run();
      }
    },
  };

  async function run() {
    resetTimers();

    const deps = new Set<Store<any>>();
    const handles: Cancel[] = [];
    let job;
    let cancelProcess: Cancel | undefined;
    const buffer: Update<Value>[] = [];
    let isCanceled = false;
    let curVal: { v: Value } | undefined;

    cancelRun = () => {
      for (const handle of handles) {
        handle();
      }

      cancelProcess?.();
      isCanceled = true;
    };

    const applyUpdate = (update: Update<Value>) => {
      if (isCanceled) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `[schummar-state:async] process has been canceled. 'set' should not be called anymore. Having no proper teardown might result in memory leaks.`
          );
        }
        return;
      }

      if (!curVal) {
        buffer.push(update);
      } else {
        if (update instanceof Function) {
          update = update(curVal.v);
        }
        curVal.v = update;
        innerStore.set(createState({ value: update }));
        setTimers();
      }
    };

    try {
      job = fn(
        (store) => {
          deps.add(store);
          return store.get();
        },
        (process) => {
          cancelProcess = process(applyUpdate);
        }
      );

      innerStore.set((s) => ({ ...s, isPending: true }));
      const value = await job;

      if (!isCanceled) {
        curVal = { v: value };
        innerStore.set(createState({ value }));
        setTimers();
        buffer.forEach(applyUpdate);
        buffer.length = 0;
      }
    } catch (error) {
      if (!isCanceled) {
        asyncStore.setError(error);
      }
    } finally {
      if (!isCanceled) {
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
