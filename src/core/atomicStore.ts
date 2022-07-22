import { calcDuration } from '../lib/calcDuration';
import { defaultEquals } from '../lib/equals';
import { forwardError } from '../lib/forwardError';
import type { Path, Value } from '../lib/propAccess';
import { get, set } from '../lib/propAccess';
import { arrayActions, mapActions, recordActions, setActions } from '../lib/storeActions';
import { throttle } from '../lib/throttle';
import type { Cancel, Duration, Effect, Listener, Store, SubscribeOptions, Update } from './types';

export type StoreActions = Record<string, (...args: any[]) => any>;

export type BoundStoreActions<Value, Actions extends StoreActions> = Actions & ThisType<AtomicStoreImpl<Value> & Actions>;

export type AtomicStore<Value> = AtomicStoreImpl<Value>;

const noop = () => {
  // noop
};

///////////////////////////////////////////////////////////
// Implementation
///////////////////////////////////////////////////////////

export class AtomicStoreImpl<V> implements Store<V> {
  private value = this.initialValue;
  private listeners = new Set<Listener<void>>();
  private effects = new Map<Effect, { handle?: Cancel; retain?: number; timeout?: ReturnType<typeof setTimeout> }>();
  private notifyId = {};

  constructor(public readonly initialValue: V) {
    this.subscribe = this.subscribe.bind(this);
    this.get = this.get.bind(this);
    this.update = this.update.bind(this);
    this.addEffect = this.addEffect.bind(this);
    this.isActive = this.isActive.bind(this);
    this.recreate = this.recreate.bind(this);
    this.addEffect = this.addEffect.bind(this);
  }

  subscribe(listener: Listener<V>, options?: SubscribeOptions): Cancel;
  subscribe<S>(selector: (value: V) => S, listener: Listener<S>, options?: SubscribeOptions): Cancel;
  subscribe<S>(
    ...[arg0, arg1, arg2]:
      | [listener: Listener<S>, options?: SubscribeOptions]
      | [selector: (value: V) => S, listener: Listener<S>, options?: SubscribeOptions]
  ) {
    const selector = (arg1 instanceof Function ? arg0 : (value) => value as any) as (value: V) => S;
    const listener = (arg1 instanceof Function ? arg1 : arg0) as Listener<S>;
    const { runNow = true, throttle: throttleOption, equals = defaultEquals } = (arg1 instanceof Function ? arg2 : arg1) ?? {};

    let last: { v: S } | undefined;
    let innerListener = () => {
      try {
        const value = selector(this.get());

        if (!last || !equals(value, last.v)) {
          const previousValue = last?.v;
          last = { v: value };

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
      innerListener();
    }

    return () => {
      this.listeners.delete(innerListener);
      this.onUnsubscribe();
    };
  }

  get() {
    return this.value;
  }

  update(update: Update<V>): this;
  update<K extends Path<V>>(path: K, update: Update<Value<V, K>>): this;
  update(...args: any[]) {
    const path: string = args.length === 2 ? args[0] : '';
    let update: Update<any> = args.length === 2 ? args[1] : args[0];

    if (update instanceof Function) {
      const before = get(this.value, path as any);
      update = update(before);
    }

    this.value = set(this.value, path as any, update);
    this.notify();
    return this;
  }

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

  isActive() {
    return this.listeners.size > 0;
  }

  recreate = () => {
    return new AtomicStoreImpl<V>(this.initialValue) as this;
  };

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

export function atomicStore<T extends Map<any, any>>(value: T): AtomicStore<T> & typeof mapActions;
export function atomicStore<T extends Set<any>>(value: T): AtomicStore<T> & typeof setActions;
export function atomicStore<T extends Array<any>>(value: T): AtomicStore<T> & typeof arrayActions;
export function atomicStore<T extends Record<any, any>>(value: T): AtomicStore<T> & typeof recordActions;
export function atomicStore<Value>(value: Value): AtomicStore<Value>;
export function atomicStore<Value, Actions extends StoreActions = StoreActions>(
  value: Value,
  actions?: BoundStoreActions<Value, Actions>
): AtomicStore<Value> & Omit<BoundStoreActions<Value, Actions>, keyof AtomicStore<Value>>;

export function atomicStore<Value, Actions extends StoreActions = StoreActions>(
  initialValue: Value,
  actions?: BoundStoreActions<Value, Actions>
): AtomicStore<Value> & Omit<BoundStoreActions<Value, Actions>, keyof AtomicStore<Value>> {
  const store = new AtomicStoreImpl(initialValue);

  if (initialValue instanceof Map) {
    actions ??= mapActions as any;
  } else if (initialValue instanceof Set) {
    actions ??= setActions as any;
  } else if (Array.isArray(initialValue)) {
    actions ??= arrayActions as any;
  } else if (initialValue instanceof Object) {
    actions ??= recordActions;
  }

  const boundActions = Object.fromEntries(
    Object.entries(actions ?? ({} as BoundStoreActions<Value, Actions>))
      .filter(([name]) => !(name in store))
      .map(([name, fn]) => [name, fn.bind(store)])
  ) as BoundStoreActions<Value, Actions>;

  return Object.assign(store, boundActions);
}
