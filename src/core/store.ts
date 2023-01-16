import { bind } from '@lib/bind';
import { calcDuration } from '@lib/calcDuration';
import { defaultEquals } from '@lib/equals';
import { forwardError } from '@lib/forwardError';
import { makeSelector } from '@lib/makeSelector';
import type { Path, Value } from '@lib/propAccess';
import { arrayActions, mapActions, recordActions, setActions } from '@lib/storeActions';
import { throttle } from '@lib/throttle';
import type { Cancel, Duration, Effect, Listener, Selector, SubscribeOptions, Update, Use, UseOptions } from './commonTypes';
import { DerivedStore } from './derivedStore';

export type StoreActions = Record<string, (...args: any[]) => any>;

export type BoundStoreActions<T, Actions extends StoreActions> = Actions & ThisType<Store<T> & Actions>;

export interface StoreOptions {
  retain?: number;
}

export interface StoreOptionsWithActions<T, Actions extends StoreActions> extends StoreOptions {
  methods?: Actions & ThisType<Store<T> & Actions & StandardActions<T>>;
}

type StandardActions<T> = T extends Map<any, any>
  ? typeof mapActions
  : T extends Set<any>
  ? typeof setActions
  : T extends Array<any>
  ? typeof arrayActions
  : T extends Record<any, any>
  ? typeof recordActions
  : Record<string, never>;

type StoreWithActions<T, Actions extends StoreActions> = Store<T> &
  Omit<BoundStoreActions<T, Actions>, keyof Store<T>> &
  StandardActions<T>;

const noop = () => undefined;

export class Store<T> {
  protected value = this.initialValue;
  protected listeners = new Set<Listener>();
  protected effects = new Map<Effect, { handle?: Cancel; retain?: number; timeout?: ReturnType<typeof setTimeout> }>();
  protected notifyId = {};

  constructor(protected readonly initialValue: T, protected readonly options: StoreOptions = {}) {
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
    let hasRun = false;

    let innerListener = (force?: boolean | void) => {
      const value = this.get();

      if (!force && equals(value, compareToValue)) {
        return;
      }

      compareToValue = value;
      const _previousValue = previousValue;
      previousValue = value;
      hasRun = true;

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
    this.onSubscribe();

    if (runNow && !hasRun) {
      innerListener(true);
    }

    return () => {
      this.listeners.delete(innerListener);
      this.onUnsubscribe();
    };
  }

  map<S>(selector: Selector<T, S>, options?: UseOptions): DerivedStore<S>;
  map<P extends Path<T>>(selector: P, options?: UseOptions): DerivedStore<Value<T, P>>;
  map(_selector: Selector<T, any> | string, options?: UseOptions): DerivedStore<any> {
    const selector = makeSelector(_selector);
    const derivedFrom = { store: this, selectors: [_selector] };

    return new DerivedStore(({ use }) => {
      return selector(use(this, options));
    }, derivedFrom);
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

  protected onSubscribe() {
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

  protected onUnsubscribe() {
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

  protected notify() {
    const n = (this.notifyId = {});
    for (const listener of [...this.listeners]) {
      listener();
      if (n !== this.notifyId) break;
    }
  }
}

const defaultOptions: StoreOptions = {};

function _store<T>(calculate: (this: { use: Use }, fns: { use: Use }) => T, options?: StoreOptions): DerivedStore<T>;
// eslint-disable-next-line @typescript-eslint/ban-types
function _store<T, Actions extends StoreActions = {}>(
  initialState: T,
  options?: StoreOptionsWithActions<T, Actions>
): StoreWithActions<T, Actions>;
function _store<T, Actions extends StoreActions>(
  initialState: T | ((this: { use: Use }, fns: { use: Use }) => T),
  options?: StoreOptionsWithActions<T, Actions>
): StoreWithActions<T, Actions> | DerivedStore<T> {
  if (initialState instanceof Function) {
    return new DerivedStore(initialState);
  }

  let methods: StoreActions | undefined = options?.methods;

  if (initialState instanceof Map) {
    methods = { ...mapActions, ...methods };
  } else if (initialState instanceof Set) {
    methods = { ...setActions, ...methods };
  } else if (Array.isArray(initialState)) {
    methods = { ...arrayActions, ...methods };
  } else if (initialState instanceof Object) {
    methods = { ...recordActions, ...methods };
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
