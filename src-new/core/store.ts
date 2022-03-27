import { Cancel } from '../../src/helpers/misc';
import { defaultEquals } from '../equals';
import { throttle } from '../lib/throttle';
import { AtomicStore, Effect, Listener } from '../types';
import { arrayActions, mapActions, setActions } from './storeActions';

export type StoreActions = Record<string, (...args: any[]) => any>;

export type BoundStoreActions<Value, Actions extends StoreActions> = Actions & ThisType<AtomicStore<Value> & Actions>;

///////////////////////////////////////////////////////////
// Implementation
///////////////////////////////////////////////////////////

export function store<K, V>(value: Map<K, V>): AtomicStore<Map<K, V>> & typeof mapActions;
export function store<T>(value: Set<T>): AtomicStore<Set<T>> & typeof setActions;
export function store<T>(value: Array<T>): AtomicStore<Array<T>> & typeof arrayActions;
export function store<Value, Actions extends StoreActions = StoreActions>(
  value: Value,
  actions?: BoundStoreActions<Value, Actions>
): AtomicStore<Value> & Omit<BoundStoreActions<Value, Actions>, keyof AtomicStore<Value>>;
export function store<Value, Actions extends StoreActions = StoreActions>(
  initialValue: Value,
  actions?: BoundStoreActions<Value, Actions>
): AtomicStore<Value> & Omit<BoundStoreActions<Value, Actions>, keyof AtomicStore<Value>> {
  let value = initialValue;
  const listeners = new Set<Listener<Value>>();
  const effects = new Map<Effect, void | Cancel | undefined>();
  let notifyId = {};

  const onSubscribe = () => {
    if (listeners.size > 0) return;

    for (const effect of effects.keys()) {
      effects.set(effect, effect());
    }
  };

  const onUnsubscribe = () => {
    if (listeners.size > 0) return;

    for (const handle of effects.values()) {
      handle?.();
    }
  };

  const notify = () => {
    const n = (notifyId = {});
    for (const listener of [...listeners]) {
      listener(store.get());
      if (n !== notifyId) break;
    }
  };

  const store: AtomicStore<Value> = {
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

    addEffect(effect) {
      effects.set(effect, listeners.size > 0 ? effect() : undefined);

      return () => {
        effects.get(effect)?.();
        effects.delete(effect);
      };
    },

    get isActive() {
      return listeners.size > 0;
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
