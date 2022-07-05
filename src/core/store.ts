import { calcTime } from '../lib/calcTime';
import { defaultEquals } from '../lib/equals';
import { throttle } from '../lib/throttle';
import { arrayActions, mapActions, setActions } from './storeActions';
import type { BaseStore, Cancel, Effect, Listener } from './types';

export type StoreActions = Record<string, (...args: any[]) => any>;

export type BoundStoreActions<Value, Actions extends StoreActions> = Actions & ThisType<BaseStore<Value> & Actions>;

const noop = () => {
  // noop
};

///////////////////////////////////////////////////////////
// Implementation
///////////////////////////////////////////////////////////

export function store<T extends Map<any, any>>(value: T): BaseStore<T> & typeof mapActions;
export function store<T extends Set<any>>(value: T): BaseStore<T> & typeof setActions;
export function store<T extends Array<any>>(value: T): BaseStore<T> & typeof arrayActions;
export function store<Value, Actions extends StoreActions = StoreActions>(
  value: Value,
  actions?: BoundStoreActions<Value, Actions>
): BaseStore<Value> & Omit<BoundStoreActions<Value, Actions>, keyof BaseStore<Value>>;
export function store<Value, Actions extends StoreActions = StoreActions>(
  initialValue: Value,
  actions?: BoundStoreActions<Value, Actions>
): BaseStore<Value> & Omit<BoundStoreActions<Value, Actions>, keyof BaseStore<Value>> {
  let value = initialValue;
  const listeners = new Set<Listener<Value>>();
  const effects = new Map<Effect, { handle?: Cancel; retain?: number; timeout?: ReturnType<typeof setTimeout> }>();
  let notifyId = {};

  const onSubscribe = () => {
    if (listeners.size > 0) return;

    for (const [effect, { handle, retain, timeout }] of effects.entries()) {
      timeout !== undefined && clearTimeout(timeout);

      effects.set(effect, {
        handle: handle ?? effect() ?? noop,
        retain,
        timeout: undefined,
      });
    }
  };

  const onUnsubscribe = () => {
    if (listeners.size > 0) return;

    for (const [effect, { handle, retain, timeout }] of effects.entries()) {
      !retain && handle?.();
      timeout !== undefined && clearTimeout(timeout);

      effects.set(effect, {
        handle: retain ? handle : undefined,
        retain,
        timeout: retain && handle ? setTimeout(handle, retain) : undefined,
      });
    }
  };

  const notify = () => {
    const n = (notifyId = {});
    for (const listener of [...listeners]) {
      listener(store.get());
      if (n !== notifyId) break;
    }
  };

  const store: BaseStore<Value> = {
    type: 'baseStore',

    initialValue,

    subscribe(listener, { runNow = true, throttle: throttleOption, equals = defaultEquals } = {}) {
      if (throttleOption) {
        listener = throttle(listener, throttleOption);
      }

      let last: { v: Value } | undefined;
      const innerListener = (value: Value) => {
        if (!last || !equals(value, last.v)) {
          last = { v: value };
          listener(value);
        }
      };

      onSubscribe();
      listeners.add(innerListener);

      if (runNow) {
        innerListener(value);
      }

      return () => {
        listeners.delete(innerListener);

        onUnsubscribe();
      };
    },

    get() {
      return value;
    },

    set(newValue) {
      if (newValue instanceof Function) {
        newValue = newValue(store.get());
      }

      value = newValue;
      notify();
    },

    addEffect(effect, retain) {
      effects.set(effect, {
        handle: listeners.size > 0 ? effect ?? noop : undefined,
        retain: retain !== undefined ? calcTime(retain) : undefined,
      });

      return () => {
        const { handle, timeout } = effects.get(effect) ?? {};
        handle?.();
        timeout !== undefined && clearTimeout(timeout);
        effects.delete(effect);
      };
    },

    isActive() {
      return listeners.size > 0;
    },

    clone() {
      return foo(initialValue, actions);
    },
  };

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

const foo = store;
