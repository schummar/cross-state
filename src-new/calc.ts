import { store } from './atomicStore';
import { Cancel, Store } from './commonTypes';

export function calc<Value>(fn: (use: <T>(store: Store<T>) => T) => Value): Store<Value> {
  let handles: Cancel[] = [];
  let value: Value | undefined;
  let id = 0;

  const s = store(1);

  const run = () => {
    if (id !== s.get()) {
      id = s.get();
      const deps = new Set<Store<any>>();

      value = fn((store) => {
        deps.add(store);
        return store.get();
      });

      for (const handle of handles) {
        handle();
      }
      handles = [];

      for (const store of deps) {
        handles.push(
          store.subscribe(
            () => {
              s.set(id + 1);
            },
            { runNow: false }
          )
        );
      }
    }
    return value!;
  };

  return {
    subscribe(listener, options) {
      return s.subscribe(() => listener(run()), options);
    },

    get() {
      return run();
    },
  };
}
