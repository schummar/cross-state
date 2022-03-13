import { Listener, Store } from './commonTypes';
import { defaultEquals } from './equals';
import { arrayActions, mapActions, setActions } from './storeHelpers';
import { throttle } from './throttle';

///////////////////////////////////////////////////////////
// Types
///////////////////////////////////////////////////////////

export interface AtomicStore<Value> extends Store<Value> {
  set(value: Value | ((value: Value) => Value)): void;
}

export interface AtomicStoreInternal<Value> extends AtomicStore<Value> {
  value: Value;
  listeners: Set<Listener<Value>>;
  notifyId: unknown;
  notify(): void;
}

export type ASActions = Record<string, (...args: any[]) => any>;

export type BoundASActions<Value, Actions extends ASActions> = Actions & ThisType<AtomicStore<Value> & Actions>;

///////////////////////////////////////////////////////////
// Implementation
///////////////////////////////////////////////////////////

export function store<K, V>(value: Map<K, V>): AtomicStore<Map<K, V>> & typeof mapActions;
export function store<T>(value: Set<T>): AtomicStore<Set<T>> & typeof setActions;
export function store<T>(value: Array<T>): AtomicStore<Array<T>> & typeof arrayActions;
export function store<Value, Actions extends ASActions = ASActions>(
  value: Value,
  actions?: BoundASActions<Value, Actions>
): AtomicStore<Value> & Omit<BoundASActions<Value, Actions>, keyof AtomicStore<Value>>;
export function store<Value, Actions extends ASActions>(
  initialValue: Value,
  actions?: BoundASActions<Value, Actions>
): AtomicStore<Value> & Omit<BoundASActions<Value, Actions>, keyof AtomicStore<Value>> {
  const store: AtomicStoreInternal<Value> = {
    value: initialValue,

    listeners: new Set(),
    notifyId: {},

    subscribe(listener, { runNow = true, throttle: throttleOption, equals = defaultEquals } = {}) {
      if (throttleOption) {
        listener = throttle(listener, throttleOption);
      }

      let last: { v: Value } | undefined;
      const innerListener = (value: Value) => {
        if (!last || !equals(value, last.v)) {
          last = { v: store.value };
          listener(store.value);
        }
      };

      store.listeners.add(innerListener);

      if (runNow) {
        innerListener(store.value);
      }

      return () => {
        store.listeners.delete(innerListener);
      };
    },

    get() {
      return store.value;
    },

    set(newValue) {
      if (newValue instanceof Function) {
        newValue = newValue(store.value);
      }

      store.value = newValue;
      store.notify();
    },

    notify() {
      const notifyId = (this.notifyId = {});
      for (const listener of [...store.listeners]) {
        listener(store.value);
        if (notifyId !== this.notifyId) break;
      }
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
    Object.entries(actions ?? ({} as BoundASActions<Value, Actions>))
      .filter(([name]) => !(name in store))
      .map(([name, fn]) => [name, fn.bind(store)])
  ) as BoundASActions<Value, Actions>;

  return Object.assign(store, boundActions);
}
