import { calcDuration } from '../lib';
import { defaultEquals, simpleShallowEquals } from '../lib/equals';
import { forwardError } from '../lib/forwardError';
import { makeSelector } from '../lib/makeSelector';
import type { MaybePromise } from '../lib/maybePromise';
import type { Path, Value } from '../lib/propAccess';
import { get, set } from '../lib/propAccess';
import { queue } from '../lib/queue';
import { arrayActions, mapActions, recordActions, setActions } from '../lib/storeActions';
import { throttle } from '../lib/throttle';
import { trackingProxy } from '../lib/trackingProxy';
import type { UnwrapPromise } from '../lib/unwrapPromise';
import type { Cancel, Duration, Effect, Listener, Selector, SubscribeOptions, Update, UpdateFrom } from './commonTypes';
import type { ResourceGroup } from './resourceGroup';

////////////////////////////////////////////////////////////////////////////////////////////////////
// Values
type Common<T> = { isUpdating: boolean; isStale: boolean; update?: Promise<T>; ref: any };
type WithValue<T> = { status: 'value'; value: T; error?: undefined } & Common<T>;
type WithError<T> = { status: 'error'; value?: undefined; error: unknown } & Common<T>;
type Pending<T> = { status: 'pending'; value?: undefined; error?: undefined } & Common<T>;

export type GetValue<T> = T extends Promise<infer S> ? T | S : T;

export type SubscribeValue<T, F> = T extends Promise<infer S> ? S | undefined : F extends true ? T | undefined : T;

export type SelectorInputValue<S, F> = F extends true ? S | undefined : S;

export type SubscribeDetails<T, F> = T extends Promise<any>
  ? WithValue<UnwrapPromise<T>> | WithError<UnwrapPromise<T>> | Pending<UnwrapPromise<T>>
  : F extends true
  ? WithValue<UnwrapPromise<T>> | WithError<UnwrapPromise<T>>
  : WithValue<T>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Actions
export type StoreActions = Record<string, (...args: any[]) => any>;

export type BoundStoreActions<T, F extends boolean, Actions extends StoreActions> = Actions & ThisType<Store<T, F> & Actions>;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Options
export interface StoreOptions<T> {
  invalidateAfter?: Duration | ((state: GetValue<T>) => Duration);
  clearAfter?: Duration | ((state: GetValue<T>) => Duration);
  resourceGroup?: ResourceGroup | ResourceGroup[];
}

export interface StoreOptionsWithActions<T, F extends boolean, Actions extends StoreActions> extends StoreOptions<T> {
  methods?: Actions & ThisType<Store<T, F> & Actions>;
}

export interface UseOptions {
  disableProxy?: boolean;
}

export interface UseFn {
  <T>(store: Store<T, any>, options?: UseOptions): GetValue<T>;
  <T, S>(store: Store<T, any>, selector: Selector<UnwrapPromise<T>, S>, options?: UseOptions): T extends Promise<any> ? Promise<S> : S;
}

export type PushFn<T> = (value: MaybePromise<T>) => void;

export interface ProviderHelpers<T = unknown> {
  use: UseFn;
  update: PushFn<T>;
  updateError: PushFn<unknown>;
}

type GetStateFn<T> = (this: ProviderHelpers<unknown>, fn: ProviderHelpers<unknown>) => T;
type ConnectStateFn<T> = (this: ProviderHelpers<T>, fn: ProviderHelpers<T>) => Cancel;

type Provider<T> = T | GetStateFn<T> | ConnectStateFn<T>;

export type Store<T, F extends boolean> = StoreImpl<T, F>;

export type StoreCache<T> = WithValue<UnwrapPromise<T>> | WithError<UnwrapPromise<T>> | Pending<UnwrapPromise<T>>;

const noop = () => undefined;
const safe = (x: any) => (x instanceof Promise ? x.catch(() => undefined) : undefined);

export class StoreImpl<T, F extends boolean> {
  private cache: StoreCache<T> = { status: 'pending', isUpdating: false, isStale: true, ref: {} };
  private cancel?: Cancel;
  private check?: () => boolean;
  private invalidateTimer?: ReturnType<typeof setTimeout>;
  private clearTimer?: ReturnType<typeof setTimeout>;
  private listeners = new Set<Listener>();
  private effects = new Map<Effect, { handle?: Cancel; retain?: number; timeout?: ReturnType<typeof setTimeout> }>();
  private notifyId = {};

  constructor(private provider: Provider<T>, private readonly options: StoreOptions<T> = {}) {
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
  get(): GetValue<T> {
    if (this.check?.() === false) {
      this.cache.isStale = true;
    }

    if (!this.cache.isStale || this.cache.update) {
      if (this.cache.update) {
        return this.cache.update as GetValue<T>;
      }

      if (this.cache.status === 'value') {
        return this.cache.value as GetValue<T>;
      }

      if (this.cache.status === 'error') {
        throw this.cache.error;
      }
    }

    this.cancel?.();

    if (this.provider instanceof Function) {
      this.getFromFunction(this.provider);
    } else {
      this.setValue(this.provider);
    }

    if (this.cache.update) {
      return this.cache.update as GetValue<T>;
    }

    if (this.cache.status === 'value') {
      return this.cache.value as GetValue<T>;
    }

    if (this.cache.status === 'error') {
      throw this.cache.error;
    }

    return undefined;
  }

  private getFromFunction(provider: GetStateFn<T> | ConnectStateFn<T>) {
    let stopped = false;
    const handles = new Array<Cancel>();
    const checks = new Array<() => boolean>();

    const use: UseFn = <T, S>(store: Store<T, F>, arg1?: UseOptions | Selector<UnwrapPromise<T>, S>, arg2?: UseOptions) => {
      const selector = arg1 instanceof Function ? arg1 : (x: any) => x;
      const { disableProxy } = (arg1 instanceof Function ? arg2 : arg1) ?? {};
      let getValue = () => {
        const value = store.get();
        if (value instanceof Promise) {
          return value.then((x) => selector(x));
        }
        return selector(value as UnwrapPromise<T>);
      };

      let value = getValue();
      let equals = (newValue: any) => newValue === value;

      if (!disableProxy) {
        [value, equals] = trackingProxy(getValue());
      }

      const ref = store.cache.ref;
      checks.push(() => store.cache.ref === ref || equals(getValue()));

      if (!stopped) {
        const cancel = store.subscribeStatus(
          (state) => [state.ref],
          () => {
            if (!this.check?.()) {
              this.invalidate();
            }
          },
          { runNow: false }
        );
        handles.push(cancel);
      }

      return value;
    };

    const q = queue();
    const ref = {};

    const update: PushFn<T> = (value) =>
      q(async () => {
        if (value instanceof Promise) {
          try {
            value = await value;
          } catch (error) {
            this._setError(error, ref);
            return;
          }
        }

        if (stopped) {
          return;
        }

        this._setValue(value, ref);
      });

    const updateError: PushFn<unknown> = (error) =>
      q(() => {
        if (stopped) {
          return;
        }

        this._setError(error, ref);
      });

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
      const value = (provider as any).apply({ use, update, updateError }, [{ use, update, updateError }]);

      if (value instanceof Function) {
        handles.push(value);

        this.cache.isUpdating = true;
        delete this.cache.update;
        this.cache.ref = ref;
      } else {
        this.setValue(value);
      }
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

    if (this.isActive) {
      safe(this.get());
    }

    this.notify();
  }

  invalidate() {
    this.cache.isUpdating = false;
    this.cache.isStale = true;
    delete this.cache.update;

    if (this.isActive) {
      safe(this.get());
    }

    this.notify();
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

  update(update: UpdateFrom<T | UnwrapPromise<T>, [SubscribeValue<T, F>, SubscribeDetails<T, F>]>): this;
  update<K extends Path<UnwrapPromise<T>>>(path: K, update: Update<Value<UnwrapPromise<T>, K>>): this;
  update(...args: any[]) {
    if (args.length === 1) {
      let update = args[0] as UpdateFrom<T | UnwrapPromise<T>, [SubscribeValue<T, F>, SubscribeDetails<T, F>]>;

      if (update instanceof Function) {
        safe(this.get());
        update = update(this.cache.value as SubscribeValue<T, F>, this.cache as SubscribeDetails<T, F>);
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
  subscribe(listener: Listener<SubscribeValue<T, F>>, options?: SubscribeOptions): Cancel;
  subscribe<S>(selector: Selector<SubscribeValue<T, F>, S>, listener: Listener<S>, options?: SubscribeOptions): Cancel;
  subscribe<P extends Path<UnwrapPromise<T>>>(
    selector: P,
    listener: Listener<Value<UnwrapPromise<T>, P>>,
    options?: SubscribeOptions
  ): Cancel;
  subscribe(
    ...[arg0, arg1, arg2]:
      | [listener: Listener<SubscribeValue<T, F>>, options?: SubscribeOptions]
      | [selector: ((value: SubscribeValue<T, F>) => any) | string, listener: Listener<any>, options?: SubscribeOptions]
  ) {
    const selector = makeSelector(arg1 instanceof Function ? arg0 : undefined);
    const listener = (arg1 instanceof Function ? arg1 : arg0) as Listener<any>;
    const options = arg1 instanceof Function ? arg2 : arg1;

    return this.subscribeStatus(
      (state) => (state.status === 'value' ? selector(state.value as SubscribeValue<T, F>) : undefined),
      listener,
      options
    );
  }

  /** Subscribe to updates. Every time the store's state changes, the callback will be executed with the new value. */
  subscribeStatus(listener: Listener<SubscribeDetails<T, F>>, options?: SubscribeOptions): Cancel;
  subscribeStatus<S>(selector: Selector<SubscribeDetails<T, F>, S>, listener: Listener<S>, options?: SubscribeOptions): Cancel;
  subscribeStatus<P extends Path<SubscribeDetails<T, F>>>(
    selector: P,
    listener: Listener<Value<SubscribeDetails<T, F>, P>>,
    options?: SubscribeOptions
  ): Cancel;
  subscribeStatus(
    ...[arg0, arg1, arg2]:
      | [listener: Listener<SubscribeDetails<T, F>>, options?: SubscribeOptions]
      | [selector: ((value: SubscribeDetails<T, F>) => any) | string, listener: Listener<any>, options?: SubscribeOptions]
  ) {
    const selector = arg1 instanceof Function ? makeSelector(arg0) : undefined;
    const listener = (arg1 instanceof Function ? arg1 : arg0) as Listener<any>;
    const { runNow = true, throttle: throttleOption, equals = defaultEquals } = (arg1 instanceof Function ? arg2 : arg1) ?? {};

    const getValue = selector ? () => selector({ ...this.cache } as SubscribeDetails<T, F>) : () => ({ ...this.cache });
    const compare = selector
      ? equals
      : ({ value: value1, ...rest1 }: any, { value2, ...rest2 }: any) => simpleShallowEquals(rest1, rest2) && equals(value1, value2);

    let previousValue = getValue();

    let innerListener = (force?: boolean | void) => {
      const value = getValue();

      if (!force && compare(value, previousValue)) {
        return;
      }

      try {
        const _previousValue = previousValue;
        previousValue = value;
        listener(value, _previousValue);
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

type StoreWithActions<T, F extends boolean, Actions extends StoreActions> = Store<T, F> &
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
    : Omit<BoundStoreActions<T, F, Actions>, keyof Store<T, F>>);

export function store<T, Actions extends StoreActions = Record<string, never>>(
  connect: ConnectStateFn<T>,
  options?: StoreOptionsWithActions<T, true, Actions>
): StoreWithActions<T, true, Actions>;

export function store<T, Actions extends StoreActions = Record<string, never>>(
  getState: GetStateFn<T>,
  options?: StoreOptionsWithActions<T, true, Actions>
): StoreWithActions<T, true, Actions>;

export function store<T, Actions extends StoreActions = Record<string, never>>(
  initialState: T,
  options?: StoreOptionsWithActions<T, false, Actions>
): StoreWithActions<T, false, Actions>;

export function store<T, Actions extends StoreActions>(
  getState: Provider<T>,
  options: StoreOptionsWithActions<T, any, Actions> = {}
): StoreWithActions<T, any, Actions> {
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
    Object.entries(methods ?? ({} as BoundStoreActions<T, any, any>))
      .filter(([name]) => !(name in store))
      .map(([name, fn]) => [name, (fn as any).bind(store)])
  ) as BoundStoreActions<T, any, any>;

  return Object.assign(store, boundActions);
}
