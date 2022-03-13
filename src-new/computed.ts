import { store } from './atomicStore';
import { Cancel, Store } from './commonTypes';
import { defaultEquals } from './equals';

export function computed<Value>(fn: (use: <T>(store: Store<T>) => T) => Value): Store<Value> {
  let handles: Cancel[] = [];
  let value: Value | undefined;
  let id: unknown;

  const innerStore = store({});

  const run = () => {
    if (id !== innerStore.get()) {
      id = innerStore.get();

      for (const handle of handles) {
        handle();
      }
      handles = [];

      const deps = new Set<Store<any>>();
      value = fn((store) => {
        deps.add(store);
        return store.get();
      });

      for (const store of deps) {
        handles.push(
          store.subscribe(
            () => {
              innerStore.set({});
            },
            { runNow: false }
          )
        );
      }
    }
    return value!;
  };

  return {
    subscribe(listener, { equals = defaultEquals, ...options } = {}) {
      let last: { v: Value | undefined };

      return innerStore.subscribe(() => {
        const value = run();

        if (!last || equals(value, last.v)) {
          listener(value);
        }
      }, options);
    },

    get() {
      return run();
    },
  };
}
