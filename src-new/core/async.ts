import { defaultEquals, shallowEquals } from '../equals';
import { Cancel, Store } from '../types';
import { once } from './once';
import { store } from './store';
import { recordActions } from './storeActions';

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

export type Time = number | { milliseconds?: number; seconds?: number; minutes?: number; hours?: number; days?: number };

export type AsyncStoreOptions<Value> = {
  invalidateAfter?: Time | ((state: AsyncStoreValue<Value>) => Time);
  clearAfter?: Time | ((state: AsyncStoreValue<Value>) => Time);
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

const calcTime = (t: Time) => {
  if (typeof t === 'number') return t;
  return (
    (t.milliseconds ?? 0) +
    (t.seconds ?? 0) * 1000 +
    (t.minutes ?? 0) * 60 * 1000 +
    (t.hours ?? 0) * 60 * 60 * 1000 +
    (t.days ?? 0) * 24 * 60 * 60 * 1000
  );
};

///////////////////////////////////////////////////////////
// Global
///////////////////////////////////////////////////////////

let defaultOptions = {
  invalidateAfter: undefined as Time | undefined,
  clearAfter: undefined as Time | undefined,
  clearUnusedAfter: { days: 1 } as Time | undefined,
};

function setDefaultOptions(options: typeof defaultOptions) {
  defaultOptions = options;
}

///////////////////////////////////////////////////////////
// Implementation
///////////////////////////////////////////////////////////

function _async<Value>(
  fn: (use: <T>(store: Store<T>) => T, register: (process: (set: UpdateFn<Value>) => Cancel) => void) => Value | Promise<Value>,
  { invalidateAfter, clearAfter }: AsyncStoreOptions<Value> = {}
): AsyncStore<Value> {
  let invalidateTimer: ReturnType<typeof setTimeout> | undefined;
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  let cancelRun: Cancel | undefined;
  const s = store(createState<Value>(), recordActions);

  let on = false;
  s.addEffect(() => {
    on = true;

    return () => {
      on = false;
    };
  });

  const asyncStore: AsyncStore<Value> = {
    get() {
      const state = s.get();
      return Object.assign<any, any>([state.value, state.error, state], state);
    },

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
      cancelRun?.();
      s.set(createState({ value }));
      setTimers();
    },

    setError(error) {
      cancelRun?.();
      s.set(createState({ error }));
      setTimers();
    },

    invalidate() {
      cancelRun?.();
      s.set((s) => ({ ...s, isPending: on, isStale: s.status !== 'empty' }));
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
        s.set(createState({ value: update }));
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

      s.set((s) => ({ ...s, isPending: true }));
      const value = await job;

      if (!isCanceled) {
        curVal = { v: value };
        s.set(createState({ value }));
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
    clearTimeout(invalidateTimer);
    clearTimeout(clearTimer);
  }

  return asyncStore;
}

export const async = Object.assign(_async, {
  setDefaultOptions,
});
