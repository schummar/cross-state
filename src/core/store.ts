import { calcDuration } from '../lib';
import { defaultEquals } from '../lib/equals';
import { forwardError } from '../lib/forwardError';
import { makeSelector } from '../lib/makeSelector';
import type { Path, Value } from '../lib/propAccess';
import { get, set } from '../lib/propAccess';
import type { promiseActions } from '../lib/storeActions';
import { arrayActions, mapActions, recordActions, setActions } from '../lib/storeActions';
import { throttle } from '../lib/throttle';
import type { Cancel, Duration, Effect, Listener, SubscribeOptions, Update, UpdateFrom } from './commonTypes';
import type { ResourceGroup } from './resourceGroup';

export type StoreActions = Record<string, (...args: any[]) => any>;

export type BoundStoreActions<Value, Actions extends StoreActions> = Actions & ThisType<Store<Value> & Actions>;

export type StorePromise<T> = Promise<T> & StorePromiseState<T>;
export type StorePromiseState<T> =
  | { state: 'pending'; value?: undefined; error?: undefined }
  | { state: 'resolved'; value: T; error?: undefined }
  | { state: 'rejected'; value?: undefined; error: unknown };

export type StoreValue<T> = T extends Promise<infer S> ? StorePromise<S> : T;

export interface StoreOptions<T> {
  invalidateAfter?: Duration | ((state: StoreValue<T>) => Duration);
  clearAfter?: Duration | ((state: StoreValue<T>) => Duration);
  resourceGroup?: ResourceGroup | ResourceGroup[];
}

export interface StoreOptionsWithActions<T, Actions extends StoreActions> extends StoreOptions<T> {
  methods?: Actions & ThisType<StoreImpl<T> & Actions>;
}

export type UseFn = <T>(store: Store<T>) => StoreValue<T>;

export type ConnectFn = (cb: () => void | Cancel) => void;

export interface HelperFns {
  use: UseFn;
  connect: ConnectFn;
}

export type Store<T> = StoreImpl<T>;

export type StoreCache<T> = { value: StoreValue<T>; deps?: Set<Cancel>; checks?: (() => boolean)[] };

const noop = () => {
  // noop
};

export class StoreImpl<T> {
  private cache?: StoreCache<T>;
  private invalidateTimer?: ReturnType<typeof setTimeout>;
  private clearTimer?: ReturnType<typeof setTimeout>;
  private listeners = new Set<Listener<void>>();
  private effects = new Map<Effect, { handle?: Cancel; retain?: number; timeout?: ReturnType<typeof setTimeout> }>();
  private notifyId = {};

  constructor(private getState: T | ((this: HelperFns, fn: HelperFns) => T), private readonly options: StoreOptions<T> = {}) {
    this.get = this.get.bind(this);
    this.invalidate = this.invalidate.bind(this);
    this.subscribe = this.subscribe.bind(this);
  }

  /** Get the current value. */
  get() {
    if (this.cache) {
      return this.cache.value;
    }

    const cache = { value: undefined } as StoreCache<T>;

    this.cache = cache;
    this.notify();

    if (cache.value instanceof Promise) {
      cache.value
        .then((value) => {
          if (this.cache === cache) {
            cache.value = Object.assign(Promise.resolve(value), {
              state: 'resolved',
              value,
            }) as StoreValue<T>;

            this.notify();
          }
        })
        .catch((error) => {
          if (this.cache === cache) {
            cache.value = Object.assign(Promise.reject(error), {
              state: 'rejected',
              error,
            }) as StoreValue<T>;

            this.notify();
          }
        });
    }

    return cache.value;
  }

  update(update: UpdateFrom<T, StoreValue<T>>): this;
  update<K extends Path<T>>(path: K, update: UpdateFrom<Value<T, K>, Value<StoreValue<T>, K>>): this;
  update(...args: any[]) {
    const path: string = args.length === 2 ? args[0] : '';
    let update: Update<any> = args.length === 2 ? args[1] : args[0];

    if (update instanceof Function) {
      const before = get(this.get(), path as any);
      update = update(before);
    }

    const value = set(this.get(), path as any, update);
    this.cache = { value };
    this.notify();
    return this;
  }

  /** Subscribe to updates. Every time the store's state changes, the callback will be executed with the new value. */
  subscribe(listener: Listener<StoreValue<T>>, options?: SubscribeOptions): Cancel;
  subscribe<S>(selector: (value: StoreValue<T>) => S, listener: Listener<S>, options?: SubscribeOptions): Cancel;
  subscribe<P extends Path<StoreValue<T>>>(selector: P, listener: Listener<Value<StoreValue<T>, P>>, options?: SubscribeOptions): Cancel;
  subscribe<S>(
    ...[arg0, arg1, arg2]:
      | [listener: Listener<S>, options?: SubscribeOptions]
      | [selector: ((value: StoreValue<T>) => S) | string, listener: Listener<S>, options?: SubscribeOptions]
  ) {
    const selector = makeSelector<StoreValue<T>, S>(arg1 instanceof Function ? arg0 : undefined);
    const listener = (arg1 instanceof Function ? arg1 : arg0) as Listener<S>;
    const { runNow = true, throttle: throttleOption, equals = defaultEquals } = (arg1 instanceof Function ? arg2 : arg1) ?? {};

    let lastValue = selector(this.get());
    let lastSentValue: S | undefined;
    let innerListener = (force?: boolean | void) => {
      try {
        const value = selector(this.get());

        if (force || !equals(value, lastValue)) {
          const previousValue = lastSentValue;
          lastValue = value;
          lastSentValue = value;

          listener(value, previousValue);
        }
      } catch (e) {
        forwardError(e);
      }
    };

    if (throttleOption) {
      innerListener = throttle(innerListener, calcDuration(throttleOption));
    }

    this.onSubscribe();
    this.listeners.add(innerListener);

    if (runNow) {
      innerListener(true);
    }

    return () => {
      this.listeners.delete(innerListener);
      this.onUnsubscribe();
    };
  }

  /** Add an effect that will be executed when the store becomes active, which means when it has at least one subscriber.
   * @param effect
   * If there is already a subscriber, the effect will be executed immediately.
   * Otherweise it will be executed as soon as the first subscription is created.
   * Every time all subscriptions are removed and the first is created again, the effect will be executed again.
   * @param retain
   * If provided, delay tearing down effects when the last subscriber is removed. This is useful if a short gap in subscriber coverage is supposed to be ignored. E.g. when switching pages, the old page might unsubscribe, while the new page subscribes immediately after.
   * @returns
   * The effect can return a teardown callback, which will be executed when the last subscription is removed and potentially the ratain time has passed.
   */
  addEffect(effect: Effect, retain?: Duration) {
    this.effects.set(effect, {
      handle: this.listeners.size > 0 ? effect ?? noop : undefined,
      retain: retain !== undefined ? calcDuration(retain) : undefined,
    });

    return () => {
      const { handle, timeout } = this.effects.get(effect) ?? {};
      handle?.();
      timeout !== undefined && clearTimeout(timeout);
      this.effects.delete(effect);
    };
  }

  invalidate() {
    delete this.cache;
  }

  /** Return whether the store is currently active, which means whether it has at least one subscriber. */
  get isActive() {
    return this.listeners.size > 0;
  }

  private onSubscribe() {
    if (this.listeners.size > 0) return;

    for (const [effect, { handle, retain, timeout }] of this.effects.entries()) {
      timeout !== undefined && clearTimeout(timeout);

      this.effects.set(effect, {
        handle: handle ?? effect() ?? noop,
        retain,
        timeout: undefined,
      });
    }
  }

  private onUnsubscribe() {
    if (this.listeners.size > 0) return;

    for (const [effect, { handle, retain, timeout }] of this.effects.entries()) {
      !retain && handle?.();
      timeout !== undefined && clearTimeout(timeout);

      this.effects.set(effect, {
        handle: retain ? handle : undefined,
        retain,
        timeout: retain && handle ? setTimeout(handle, retain) : undefined,
      });
    }
  }

  private notify() {
    const n = (this.notifyId = {});
    for (const listener of [...this.listeners]) {
      listener();
      if (n !== this.notifyId) break;
    }
  }
}

export function store<T, Actions extends StoreActions>(
  getState: ConstructorParameters<typeof StoreImpl<T>>[0],
  options: StoreOptionsWithActions<T, Actions> = {}
): Store<T> &
  (Record<string, never> extends Actions
    ? T extends Map<any, any>
      ? typeof mapActions
      : T extends Promise<any>
      ? typeof promiseActions
      : Record<string, never>
    : Omit<BoundStoreActions<T, Actions>, keyof Store<T>>) {
  let methods = options.methods;

  if (getState instanceof Map) {
    methods ??= mapActions as any;
  } else if (getState instanceof Set) {
    methods ??= setActions as any;
  } else if (Array.isArray(getState)) {
    methods ??= arrayActions as any;
  } else if (getState instanceof Object) {
    methods ??= recordActions as any;
  }

  const store = new StoreImpl(getState, options);

  const boundActions = Object.fromEntries(
    Object.entries(methods ?? ({} as BoundStoreActions<T, any>))
      .filter(([name]) => !(name in store))
      .map(([name, fn]) => [name, (fn as any).bind(store)])
  ) as BoundStoreActions<T, any>;

  return Object.assign(store, boundActions);
}
