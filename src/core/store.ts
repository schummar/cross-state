import { calcDuration } from '@lib';
import { defaultEquals } from '@lib/equals';
import { forwardError } from '@lib/forwardError';
import { makeSelector } from '@lib/makeSelector';
import type { Path, Value } from '@lib/propAccess';
import { arrayActions, mapActions, recordActions, setActions } from '@lib/storeActions';
import { throttle } from '@lib/throttle';
import { bind } from '../lib/bind';
import type { Cancel, Duration, Effect, Listener, Selector, SubscribeOptions, Update } from './commonTypes';

export type StoreActions = Record<string, (...args: any[]) => any>;

export type BoundStoreActions<T, Actions extends StoreActions> = Actions & ThisType<Store<T> & Actions>;

export interface StoreOptions {
  retain?: number;
}

export interface StoreOptionsWithActions<T, Actions extends StoreActions> extends StoreOptions {
  methods?: Actions & ThisType<Store<T> & Actions>;
}

type StoreWithActions<T, Actions extends StoreActions> = Store<T> &
  (Record<string, never> extends Actions
    ? T extends Map<any, any>
      ? typeof mapActions
      : T extends Set<any>
      ? typeof setActions
      : T extends Array<any>
      ? typeof arrayActions
      : T extends Record<any, any>
      ? typeof recordActions
      : Record<string, never>
    : Omit<BoundStoreActions<T, Actions>, keyof Store<T>>);

const noop = () => undefined;

export class Store<T> {
  protected value = this.initialValue;
  protected listeners = new Set<Listener>();
  protected effects = new Map<Effect, { handle?: Cancel; retain?: number; timeout?: ReturnType<typeof setTimeout> }>();
  protected notifyId = {};

  constructor(protected initialValue: T, protected options: StoreOptions = {}) {
    bind(this);
  }

  get(): T {
    return this.value;
  }

  update(update: Update<T>): void {
    if (update instanceof Function) {
      update = update(this.get());
    }

    this.value = update;
    this.notify();
  }

  sub(listener: Listener<T>, options?: SubscribeOptions): Cancel {
    const { runNow = true, throttle: throttleOption, equals = defaultEquals } = options ?? {};

    let compareToValue = this.get();
    let previousValue: T | undefined;

    let innerListener = (force?: boolean | void) => {
      const value = this.get();

      if (!force && equals(value, compareToValue)) {
        return;
      }

      compareToValue = value;
      const _previousValue = previousValue;
      previousValue = value;

      try {
        listener(value, _previousValue);
      } catch (error) {
        forwardError(error);
      }
    };

    if (throttleOption) {
      innerListener = throttle(innerListener, calcDuration(throttleOption));
    }

    this.listeners.add(innerListener);

    if (runNow) {
      innerListener(true);
    }

    this.onSubscribe();

    return () => {
      this.listeners.delete(innerListener);
      this.onUnsubscribe();
    };
  }

  map<S>(selector: Selector<T, S>): Store<S>;
  map<P extends Path<T>>(selector: P): Store<Value<T, P>>;
  map(_selector: Selector<T, any> | string): Store<any> {
    const selector = makeSelector(_selector);

    // const parentStore = {
    //   store: this.options.parentStore?.store ?? (this as Store<any, any>),
    //   selectors: this.options.parentStore?.selectors.slice() ?? [],
    // };
    // parentStore.selectors.push(_selector);

    // return store(
    //   ({ use }) => {
    //     const value = use(this);

    //     if (value instanceof Promise) {
    //       return value.then((value) => selector(value as UnwrapPromise<T>));
    //     }

    //     return selector(value as UnwrapPromise<T>);
    //   },
    //   {
    //     parentStore,
    //   }
    // );
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
      handle: this.listeners.size > 0 ? effect() ?? noop : undefined,
      retain: retain !== undefined ? calcDuration(retain) : undefined,
    });

    return () => {
      const { handle, timeout } = this.effects.get(effect) ?? {};
      handle?.();
      timeout !== undefined && clearTimeout(timeout);
      this.effects.delete(effect);
    };
  }

  /** Return whether the store is currently active, which means whether it has at least one subscriber. */
  get isActive() {
    return this.listeners.size > 0;
  }

  private onSubscribe() {
    if (this.listeners.size > 1) return;

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

const defaultOptions: StoreOptions = {};

function _store<T, Actions extends StoreActions = Record<string, never>>(
  initialState: T,
  options?: StoreOptionsWithActions<T, Actions>
): StoreWithActions<T, Actions> {
  let methods = options?.methods;

  if (initialState instanceof Map) {
    methods ??= mapActions as any;
  } else if (initialState instanceof Set) {
    methods ??= setActions as any;
  } else if (Array.isArray(initialState)) {
    methods ??= arrayActions as any;
  } else if (initialState instanceof Object) {
    methods ??= recordActions as any;
  }

  const store = new Store(initialState, options);

  const boundActions = Object.fromEntries(
    Object.entries(methods ?? ({} as BoundStoreActions<T, any>))
      .filter(([name]) => !(name in store))
      .map(([name, fn]) => [name, (fn as any).bind(store)])
  ) as BoundStoreActions<T, any>;

  return Object.assign(store, boundActions);
}

export const store = Object.assign(_store, { defaultOptions });
