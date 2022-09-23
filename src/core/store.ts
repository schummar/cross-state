import { calcDuration } from '../lib';
import { defaultEquals, simpleShallowEquals } from '../lib/equals';
import { forwardError } from '../lib/forwardError';
import { makeSelector } from '../lib/makeSelector';
import type { MaybePromise } from '../lib/maybePromise';
import type { Path, Value } from '../lib/propAccess';
import { get, set } from '../lib/propAccess';
import { arrayActions, mapActions, recordActions, setActions } from '../lib/storeActions';
import { throttle } from '../lib/throttle';
import type { UnwrapPromise } from '../lib/unwrapPromise';
import type { Cancel, Duration, Effect, Listener, SubscribeOptions, Update, UpdateFrom } from './commonTypes';
import type { ResourceGroup } from './resourceGroup';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Values
type Common<T> = { isUpdating: boolean; isStale: boolean; update?: Promise<T>; ref: any };
type WithValue<T> = { status: 'value'; value: T; error?: undefined } & Common<T>;
type WithError<T> = { status: 'error'; value?: undefined; error: unknown } & Common<T>;
type Pending<T> = { status: 'pending'; value?: undefined; error?: undefined } & Common<T>;

export type StoreValue<T> = T extends Promise<infer S> ? T | S : T;

export type StoreSubValue<T, G> = T extends Promise<infer S>
  ? S | undefined
  : G extends (...args: any[]) => MaybePromise<infer S>
  ? S | undefined
  : T;

export type StoreSelectorSubValue<S, G> = G extends (...args: any[]) => any ? S | undefined : S;

export type StoreSubDetails<T, G> = T extends Promise<any>
  ? WithValue<UnwrapPromise<T>> | WithError<UnwrapPromise<T>> | Pending<UnwrapPromise<T>>
  : G extends (...args: any[]) => any
  ? WithValue<UnwrapPromise<T>> | WithError<UnwrapPromise<T>>
  : WithValue<T>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Actions
export type StoreActions = Record<string, (...args: any[]) => any>;

export type BoundStoreActions<T, Actions extends StoreActions> = Actions & ThisType<Store<T> & Actions>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Options
export interface StoreOptions<T> {
  invalidateAfter?: Duration | ((state: StoreValue<T>) => Duration);
  clearAfter?: Duration | ((state: StoreValue<T>) => Duration);
  resourceGroup?: ResourceGroup | ResourceGroup[];
}

export interface StoreOptionsWithActions<T, G extends GetState<T>, Actions extends StoreActions> extends StoreOptions<T> {
  methods?: Actions & ThisType<StoreImpl<T, G> & Actions>;
}

export type UseFn = <T>(store: Store<T>) => StoreValue<T>;

export type ConnectFn = (cb: () => void | Cancel) => void;

export interface HelperFns {
  use: UseFn;
  connect: ConnectFn;
}

type GetState<T> = T | ((this: HelperFns, fn: HelperFns) => T);

export type Store<T, G extends GetState<T> = T> = StoreImpl<T, G>;

export type StoreCache<T> = WithValue<UnwrapPromise<T>> | WithError<UnwrapPromise<T>> | Pending<UnwrapPromise<T>>;

const noop = () => undefined;
const safe = (x: any) => (x instanceof Promise ? x.catch(() => undefined) : undefined);

export class StoreImpl<T, G extends GetState<T>> {
  private cache: StoreCache<T> = { status: 'pending', isUpdating: false, isStale: true, ref: {} };
  private cancel?: Cancel;
  private check?: () => boolean;
  private invalidateTimer?: ReturnType<typeof setTimeout>;
  private clearTimer?: ReturnType<typeof setTimeout>;
  private listeners = new Set<Listener>();
  private effects = new Map<Effect, { handle?: Cancel; retain?: number; timeout?: ReturnType<typeof setTimeout> }>();
  private notifyId = {};

  constructor(private getState: GetState<T>, private readonly options: StoreOptions<T> = {}) {
    this.get = this.get.bind(this);
    this.update = this.update.bind(this);
    this.subscribe = this.subscribe.bind(this);
    this.addEffect = this.addEffect.bind(this);
    this.invalidate = this.invalidate.bind(this);
    this.onSubscribe = this.onSubscribe.bind(this);
    this.onUnsubscribe = this.onUnsubscribe.bind(this);
    this.notify = this.notify.bind(this);

    this.addEffect(() => {
      safe(this.get());

      return () => {
        this.cancel?.();
      };
    });
  }

  /** Get the current value. */
  get(): StoreValue<T> {
    if (this.check?.() === false) {
      this.cache.isStale = true;
    }

    if (!this.cache.isStale || this.cache.update) {
      // TODO check
      if (this.cache.update) {
        return this.cache.update as StoreValue<T>;
      }

      if (this.cache.status === 'value') {
        return this.cache.value as StoreValue<T>;
      }

      if (this.cache.status === 'error') {
        throw this.cache.error;
      }
    }

    this.cancel?.();

    if (this.getState instanceof Function) {
      this.getFromFunction(this.getState);
    } else {
      this.setValue(this.getState);
    }

    if (this.cache.update) {
      return this.cache.update as StoreValue<T>;
    }

    if (this.cache.status === 'value') {
      return this.cache.value as StoreValue<T>;
    }

    throw this.cache.error;
  }

  private getFromFunction(getState: (this: HelperFns, fn: HelperFns) => T) {
    let stopped = false;
    const handles = new Array<Cancel>();
    const checks = new Array<() => boolean>();

    const use: UseFn = (store) => {
      const value = store.get();
      const ref = store.cache.ref;
      checks.push(() => store.cache.ref === ref);

      if (!stopped) {
        const cancel = store.subscribe((_v, state) => state.ref, this.invalidate, { runNow: false });
        handles.push(cancel);
      }

      return value;
    };

    const connect: ConnectFn = () => {
      // TODO implement
    };

    this.cancel = () => {
      stopped = true;

      for (const handle of handles) {
        handle();
      }

      handles.length = 0;
      delete this.cancel;
    };

    this.check = () => {
      return checks.every((check) => check());
    };

    try {
      const value = getState.apply({ use, connect }, [{ use, connect }]);
      this.setValue(value);
    } catch (error) {
      this.setError(error);
    }
  }

  setValue(value: T | UnwrapPromise<T>) {
    this._setValue(value);
  }

  _setValue(value: T | UnwrapPromise<T>, ref = {}) {
    if (value instanceof Promise) {
      this.cache.isUpdating = true;
      this.cache.update = value;
      this.cache.ref = ref;

      this.watchPromise(value);
    } else {
      this.cache.isUpdating = false;
      this.cache.isStale = false;
      delete this.cache.update;
      this.cache.status = 'value';
      this.cache.value = value as UnwrapPromise<T>;
      delete this.cache.error;
      this.cache.ref = ref;
    }

    this.notify();
  }

  setError(error: unknown) {
    this._setError(error);
  }

  _setError(error: unknown, ref = {}) {
    this.cache.isUpdating = false;
    this.cache.isStale = false;
    delete this.cache.update;
    this.cache.status = 'error';
    delete this.cache.value;
    this.cache.error = error;
    this.cache.ref = ref;

    this.notify();
  }

  clear() {
    this.cache.isUpdating = false;
    this.cache.isStale = true;
    delete this.cache.update;
    this.cache.status = 'pending';
    delete this.cache.value;
    delete this.cache.error;
    this.cache.ref = {};

    this.notify();
  }

  invalidate() {
    this.cache.isUpdating = false;
    this.cache.isStale = true;
    delete this.cache.update;
    this.cache.ref = {};

    if (this.isActive) {
      safe(this.get());
    } else {
      this.notify();
    }
  }

  private async watchPromise(promise: Promise<UnwrapPromise<T>>) {
    const isActive = () => promise === this.cache.update;

    try {
      const value = await promise;
      if (isActive()) {
        this._setValue(value as T, this.cache.ref);
      }
    } catch (error) {
      if (isActive()) {
        this._setError(error, this.cache.ref);
      }
    }
  }

  update(update: UpdateFrom<T | UnwrapPromise<T>, [StoreSubValue<T, G>, StoreSubDetails<T, G>]>): this;
  update<K extends Path<UnwrapPromise<T>>>(path: K, update: Update<Value<UnwrapPromise<T>, K>>): this;
  update(...args: any[]) {
    if (args.length === 1) {
      let update = args[0] as UpdateFrom<T | UnwrapPromise<T>, [StoreSubValue<T, G>, StoreSubDetails<T, G>]>;

      if (update instanceof Function) {
        safe(this.get());
        update = update(this.cache.value as StoreSubValue<T, G>, this.cache as StoreSubDetails<T, G>);
      }

      this.setValue(update);
    } else {
      if (this.cache.status !== 'value') {
        return;
      }

      const path = args[0] as string;
      let update = args[1] as Update<any>;
      let value: any = get(this.cache.value, path as any);

      if (update instanceof Function) {
        update = update(value);
      }

      value = set(value, path, update);
      this.setValue(value);
    }

    this.notify();
    return this;
  }

  /** Subscribe to updates. Every time the store's state changes, the callback will be executed with the new value. */
  subscribe(
    listener: Listener<[value: StoreSubValue<T, G>, previousValue: StoreSubValue<T, G> | undefined, state: StoreSubDetails<T, G>]>,
    options?: SubscribeOptions
  ): Cancel;
  subscribe<S>(
    selector: (value: StoreSubValue<T, G>, state: StoreSubDetails<T, G>) => S,
    listener: Listener<[value: StoreSelectorSubValue<S, G>, previouseValue?: StoreSelectorSubValue<S, G>]>,
    options?: SubscribeOptions
  ): Cancel;
  subscribe<P extends Path<UnwrapPromise<T>>>(
    selector: P,
    listener: Listener<
      [value: StoreSelectorSubValue<Value<UnwrapPromise<T>, P>, G>, previousValue?: StoreSelectorSubValue<Value<UnwrapPromise<T>, P>, G>]
    >,
    options?: SubscribeOptions
  ): Cancel;
  subscribe(
    ...[arg0, arg1, arg2]:
      | [
          listener: Listener<[StoreSubValue<any, any>, StoreSubValue<any, any> | undefined, StoreSubDetails<T, G>]>,
          options?: SubscribeOptions
        ]
      | [
          selector: ((value: StoreSubValue<T, G>, state: StoreSubDetails<T, G>) => any) | string,
          listener: Listener<[StoreSelectorSubValue<any, G>]>,
          options?: SubscribeOptions
        ]
  ) {
    const selector =
      arg1 instanceof Function
        ? makeSelector(arg0 as ((value: StoreSubValue<T, G>, state: StoreSubDetails<T, G>) => any) | string)
        : undefined;
    const listener = (arg1 instanceof Function ? arg1 : arg0) as Listener<any>;
    const { runNow = true, throttle: throttleOption, equals = defaultEquals } = (arg1 instanceof Function ? arg2 : arg1) ?? {};

    let getValue: () => any, getDetails: () => any;

    if (selector) {
      getValue = () => selector(this.cache.value as StoreSubValue<T, G>, this.cache as StoreSubDetails<T, G>);
      getDetails = () => undefined;
    } else {
      getValue = () => this.cache.value;
      getDetails = () => ({ ...this.cache });
    }

    let previous = {
      value: getValue(),
      details: getDetails(),
    };

    let innerListener = (force?: boolean) => {
      const value = getValue();
      const details = getDetails();

      const a = { ...previous.details, value: undefined };
      const b = { ...details, value: undefined };

      if (!force && equals(previous.value, value) && simpleShallowEquals(a, b)) {
        return;
      }

      try {
        listener(...(details ? [value, previous.value, details] : [value, previous.value]));
        previous = { value, details };
      } catch (error) {
        forwardError(error);
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

type StoreWithActions<T, G extends GetState<T>, Actions extends StoreActions> = Store<T, G> &
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
    : Omit<BoundStoreActions<T, Actions>, keyof Store<T, G>>);

export function store<G extends (this: HelperFns, fn: HelperFns) => any, Actions extends StoreActions = Record<string, never>>(
  getState: G,
  options?: StoreOptionsWithActions<G extends (this: HelperFns, fn: HelperFns) => infer T ? T : never, G, Actions>
): StoreWithActions<G extends (this: HelperFns, fn: HelperFns) => infer T ? T : never, G, Actions>;

export function store<T, Actions extends StoreActions = Record<string, never>>(
  initialState: T,
  options?: StoreOptionsWithActions<T, T, Actions>
): StoreWithActions<T, T, Actions>;

export function store<T, G extends GetState<T>, Actions extends StoreActions>(
  getState: G,
  options: StoreOptionsWithActions<T, G, Actions> = {}
): StoreWithActions<T, G, Actions> {
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
