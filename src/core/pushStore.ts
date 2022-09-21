import { Cache } from '../lib/cache';
import { calcDuration } from '../lib/calcDuration';
import { makeSelector } from '../lib/makeSelector';
import type { MaybePromise } from '../lib/maybePromise';
import type { Path, Value } from '../lib/propAccess';
import { queue } from '../lib/queue';
import type { AsyncStoreValue } from './asyncStore';
import { asyncStoreValueEquals, createState } from './asyncStore';
import { atomicStore } from './atomicStore';
import { once } from './once';
import type { Cancel, Duration, Effect, Listener, Store, SubscribeOptions } from './commonTypes';

///////////////////////////////////////////////////////////
// Types
///////////////////////////////////////////////////////////

export type PushStoreOptions = {
  retain?: Duration;
  clearUnusedAfter?: Duration;
};

export interface PushCollection<Value, Args extends any[]> {
  (...args: Args): PushStore<Value, Args>;
}

export interface PushAction<Value, Args extends any[]> {
  (
    this: {
      use: <T>(store: Store<T>) => T;
      update: (update: MaybePromise<Value> | ((value?: Value) => MaybePromise<Value>)) => Promise<void>;
      updateError: (error: unknown) => Promise<void>;
      updateIsPending: (isPending: boolean) => void;
      reconnect: () => void;
    },
    ...args: Args
  ): void | Cancel;
}

export type PushStore<Value, Args extends any[]> = PushStoreImpl<Value, Args>;

///////////////////////////////////////////////////////////
// Global
///////////////////////////////////////////////////////////

let defaultOptions: PushStoreOptions = {
  retain: undefined,
  clearUnusedAfter: { days: 1 },
};

function setDefaultOptions(options: typeof defaultOptions) {
  defaultOptions = options;
}

///////////////////////////////////////////////////////////
// Implementation
///////////////////////////////////////////////////////////

class PushStoreImpl<V, Args extends any[]> implements Store<AsyncStoreValue<V>> {
  private readonly args: Args;
  private internalStore = atomicStore(createState<V>());
  private cancel?: Cancel;

  constructor(private readonly fn: PushAction<V, Args>, private readonly options?: PushStoreOptions, ...args: Args) {
    this.args = args;

    this.internalStore.addEffect(() => {
      this.connect();

      return () => {
        this.cancel?.();
      };
    }, options?.retain);

    this.get = this.get.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.addEffect = this.addEffect.bind(this);
    this.isActive = this.isActive.bind(this);
    this.recreate = this.recreate.bind(this);
    this.getPromise = this.getPromise.bind(this);
    this.set = this.set.bind(this);
    this.setError = this.setError.bind(this);
    this.connect = this.connect.bind(this);
  }

  get() {
    return this.internalStore.get();
  }

  subscribe(listener: Listener<AsyncStoreValue<V>>, options?: SubscribeOptions): Cancel;
  subscribe<S>(selector: (value: AsyncStoreValue<V>) => S, listener: Listener<S>, options?: SubscribeOptions): Cancel;
  subscribe<P extends Path<AsyncStoreValue<V>>>(
    selector: P,
    listener: Listener<Value<AsyncStoreValue<V>, P>>,
    options?: SubscribeOptions
  ): Cancel;
  subscribe<S>(
    ...[arg0, arg1, arg2]:
      | [listener: Listener<S>, options?: SubscribeOptions]
      | [selector: ((value: AsyncStoreValue<V>) => S) | string, listener: Listener<S>, options?: SubscribeOptions]
  ) {
    const selector = makeSelector<AsyncStoreValue<V>, S>(arg1 instanceof Function ? arg0 : undefined);
    const listener = (arg1 instanceof Function ? arg1 : arg0) as Listener<S>;
    const options = arg1 instanceof Function ? arg2 : arg1;

    return this.internalStore.subscribe(() => listener(selector(this.get())), {
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
    return new PushStoreImpl(this.fn, this.options, ...this.args) as this;
  }

  async getPromise({ returnStale }: { returnStale?: boolean } = {}) {
    const state = await once(
      this,
      (state): state is AsyncStoreValue<V> & { status: 'value' | 'error' } =>
        (returnStale || !state.isStale) && (state.status === 'value' || state.status === 'error')
    );
    if (state.status === 'value') {
      return state.value;
    }
    throw state.error;
  }

  set(value: V | ((value?: V) => V)) {
    if (value instanceof Function) {
      value = value(this.get().value);
    }
    this.internalStore.update(createState({ value, status: 'value' }));
  }

  setError(error: unknown) {
    this.internalStore.update(createState({ error, status: 'error' }));
  }

  private connect() {
    this.cancel?.();

    this.internalStore.update((state) => createState({ ...state, isPending: true }));

    let isCanceled = false;
    const q = queue();
    const deps = new Map<Store<any>, Cancel>();

    const check = (name: string) => {
      if (isCanceled) {
        if (!import.meta.env.PROD) {
          console.warn(
            `[schummar-state:pushStore] process has been canceled. '${name}' should not be called anymore. Having no proper teardown might result in memory leaks.`
          );
        }
      }
      return isCanceled;
    };

    const cancelAction = this.fn.apply(
      {
        use: (s) => {
          if (!isCanceled && !deps.has(s)) {
            deps.set(s, s.subscribe(this.connect, { runNow: false }));
          }

          return s.get();
        },

        update: async (value) => {
          if (check('update')) return;

          await q(async () => {
            if (value instanceof Function) {
              value = value(this.internalStore.get().value);
            }

            if (value instanceof Promise) {
              value = await value;
            }

            if (!isCanceled) {
              this.internalStore.update(createState({ value, status: 'value' }));
            }
          });
        },

        updateError: async (error) => {
          if (check('setError')) return;

          return q(async () => {
            if (!isCanceled) {
              this.internalStore.update(createState({ error, status: 'error' }));
            }
          });
        },

        updateIsPending: (isPending) => {
          if (check('updateIsPending')) return;

          this.internalStore.update((s) => createState({ ...s, isPending }));
        },

        reconnect: this.connect,
      },
      this.args
    );

    this.cancel = () => {
      this.internalStore.update((s) => createState({ ...s, isPending: false, isStale: true }));
      isCanceled = true;
      cancelAction?.();
      q.clear();
      for (const handle of deps.values()) {
        handle();
      }
      this.cancel = undefined;
    };
  }
}

function getPushStore<Value = unknown, Args extends any[] = []>(
  fn: PushAction<Value, Args>,
  options: PushStoreOptions = {}
): PushCollection<Value, Args> {
  const cache = new Cache(
    (...args: Args) => new PushStoreImpl(fn, options, ...args),
    calcDuration(options.clearUnusedAfter ?? defaultOptions.clearUnusedAfter ?? 0)
  );

  return (...args: Args) => {
    return cache.get(...args);
  };
}

export const pushStore = Object.assign(getPushStore, {
  setDefaultOptions,
});
