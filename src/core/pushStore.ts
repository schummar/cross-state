import { hash } from '../lib/hash';
import { MaybePromise } from '../lib/maybePromise';
import { queue } from '../lib/queue';
import { Cancel, Store, Time } from '../types';
import { AsyncStoreValue, asyncStoreValueEquals, createState } from './asyncStore';
import { once } from './once';
import { store } from './store';

///////////////////////////////////////////////////////////
// Types
///////////////////////////////////////////////////////////

export type PushStoreOptions = {
  retain?: Time;
};

export interface PushStore<Value> extends Store<AsyncStoreValue<Value>> {
  getPromise(options?: { returnStale?: boolean }): Promise<Value>;
  set(update: Value | ((value?: Value) => Value)): void;
  setError(error: unknown): void;
}

export interface PushCollection<Value, Args extends any[]> {
  (...args: Args): PushStore<Value>;
}

export interface PushAction<Value, Args extends any[]> {
  (
    this: {
      use: <T>(store: Store<T>) => T;
      set: (update: MaybePromise<Value> | ((value?: Value) => MaybePromise<Value>)) => Promise<void>;
      setError: (error: unknown) => Promise<void>;
    },
    ...args: Args
  ): void | Cancel;
}

///////////////////////////////////////////////////////////
// Implementation
///////////////////////////////////////////////////////////

export function pushStore<Value = unknown, Args extends any[] = []>(
  fn: PushAction<Value, Args>,
  options?: PushStoreOptions
): PushCollection<Value, Args> {
  const { retain = 1000 } = options ?? {};
  const collection = new Map<string, PushStore<Value>>();

  const createPushStore = (...args: Args) => {
    const s = store(createState<Value>());
    let cancel: Cancel | undefined;

    const connect = () => {
      cancel?.();

      let isCanceled = false;
      const q = queue();
      const deps = new Map<Store<any>, Cancel>();

      const cancelAction = fn.apply(
        {
          use(s) {
            if (!deps.has(s)) {
              deps.set(s, s.subscribe(connect, { runNow: false }));
            }

            return s.get();
          },

          async set(value) {
            if (isCanceled) {
              if (process.env.NODE_ENV !== 'production') {
                console.warn(
                  `[schummar-state:pushStore] process has been canceled. 'set' should not be called anymore. Having no proper teardown might result in memory leaks.`
                );
              }
              return;
            }

            await q(async () => {
              if (value instanceof Function) {
                value = value(s.get().value);
              }

              if (value instanceof Promise) {
                value = await value;
              }

              if (!isCanceled) {
                s.set(createState({ value }));
              }
            });
          },

          async setError(error) {
            if (isCanceled) {
              if (process.env.NODE_ENV !== 'production') {
                console.warn(
                  `[schummar-state:pushStore] process has been canceled. 'setError' should not be called anymore. Having no proper teardown might result in memory leaks.`
                );
              }
              return;
            }

            return q(async () => {
              if (!isCanceled) {
                s.set(createState({ error }));
              }
            });
          },
        },
        args
      );

      cancel = () => {
        isCanceled = true;
        cancelAction?.();
        q.clear();
        for (const handle of deps.values()) {
          handle();
        }
        cancel = undefined;
      };
    };

    s.addEffect(() => {
      connect();

      return () => {
        cancel?.();
      };
    }, retain);

    const pushStore: PushStore<Value> = {
      get() {
        const state = s.get();
        return Object.assign<any, any>([state.value, state.error, state.isPending, state.isStale, state.status], state);
      },

      subscribe(listener, options) {
        return s.subscribe(() => listener(pushStore.get()), {
          ...options,
          equals: (a, b) => asyncStoreValueEquals(a, b, options?.equals),
        });
      },

      async getPromise({ returnStale } = {}) {
        const state = await once(
          pushStore,
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
          value = value(pushStore.get().value);
        }
        s.set(createState({ value }));
      },

      setError(error) {
        s.set(createState({ error }));
      },

      addEffect: s.addEffect,
      get isActive() {
        return s.isActive;
      },
    };

    return pushStore;
  };

  function getAsyncStore(...args: Args) {
    const key = hash(args);
    let asyncStore = collection.get(key);
    if (!asyncStore) {
      asyncStore = createPushStore(...args);
      collection.set(key, asyncStore);
    }
    return asyncStore;
  }

  return Object.assign(getAsyncStore, {});
}
