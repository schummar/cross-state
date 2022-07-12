import { calcDuration } from '../lib/calcDuration';
import { defaultEquals } from '../lib/equals';
import { forwardError } from '../lib/forwardError';
import { throttle } from '../lib/throttle';
import { arrayActions, mapActions, setActions } from './storeActions';
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

class AtomicStoreImpl<Value> implements Store<Value> {
  private value = this.initialValue;
  private listeners = new Set<Listener<any>>();
  private effects = new Map<Effect, { handle?: Cancel; retain?: number; timeout?: ReturnType<typeof setTimeout> }>();
  private notifyId = {};

  constructor(public readonly initialValue: Value) {
    this.subscribe = this.subscribe.bind(this);
    this.get = this.get.bind(this);
    this.set = this.set.bind(this);
    this.addEffect = this.addEffect.bind(this);
    this.isActive = this.isActive.bind(this);
    this.recreate = this.recreate.bind(this);
    this.addEffect = this.addEffect.bind(this);
  }

  subscribe(listener: Listener<Value>, options?: SubscribeOptions): Cancel;
  subscribe<S>(listener: Listener<S>, selector: (value: Value) => S, options?: SubscribeOptions): Cancel;
  subscribe<S>(
    listener: Listener<S>,
    ...[arg1, arg2]: [options?: SubscribeOptions] | [selector: (value: Value) => S, options?: SubscribeOptions]
  ) {
    const selector: (value: Value) => S = arg1 instanceof Function ? arg1 : (value) => value as any;
    const { runNow = true, throttle: throttleOption, equals = defaultEquals, tag } = (arg1 instanceof Function ? arg2 : arg1) ?? {};

    let last: { v: S } | undefined;
    let innerListener = (notifyTag?: any) => {
      try {
        if (tag !== undefined && tag === notifyTag) {
          return;
        }

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
      innerListener(this.value);
    }

    return () => {
      this.listeners.delete(innerListener);
      this.onUnsubscribe();
    };
  }

  get() {
    return this.value;
  }

  set(newValue: Update<Value>, tag?: any) {
    if (newValue instanceof Function) {
      newValue = newValue(this.get());
    }

    this.value = newValue;
    this.notify(tag);
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
    return new AtomicStoreImpl<Value>(this.initialValue) as this;
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

  private notify(tag?: any) {
    const n = (this.notifyId = {});
    for (const listener of [...this.listeners]) {
      listener(tag);
      if (n !== this.notifyId) break;
    }
  }
}

export function atomicStore<T extends Map<any, any>>(value: T): AtomicStoreImpl<T> & typeof mapActions;
export function atomicStore<T extends Set<any>>(value: T): AtomicStoreImpl<T> & typeof setActions;
export function atomicStore<T extends Array<any>>(value: T): AtomicStoreImpl<T> & typeof arrayActions;
export function atomicStore<Value, Actions extends StoreActions = StoreActions>(
  value: Value,
  actions?: BoundStoreActions<Value, Actions>
): AtomicStoreImpl<Value> & Omit<BoundStoreActions<Value, Actions>, keyof AtomicStoreImpl<Value>>;

export function atomicStore<Value, Actions extends StoreActions = StoreActions>(
  initialValue: Value,
  actions?: BoundStoreActions<Value, Actions>
): AtomicStoreImpl<Value> & Omit<BoundStoreActions<Value, Actions>, keyof AtomicStoreImpl<Value>> {
  const store = new AtomicStoreImpl(initialValue);

  if (initialValue instanceof Map && !actions) {
    actions = mapActions as any;
  } else if (initialValue instanceof Set && !actions) {
    actions = setActions as any;
  } else if (Array.isArray(initialValue) && !actions) {
    actions = arrayActions as any;
  }

  const boundActions = Object.fromEntries(
    Object.entries(actions ?? ({} as BoundStoreActions<Value, Actions>))
      .filter(([name]) => !(name in store))
      .map(([name, fn]) => [name, fn.bind(store)])
  ) as BoundStoreActions<Value, Actions>;

  return Object.assign(store, boundActions);
}
