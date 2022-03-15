import { Cancel, Store } from '../types';
import { store } from './store';

const throws = {
  get v(): any {
    throw Error('[schummar-state:compute] circular reference in computation!');
  },
};

export function computed<Value>(fn: (use: <T>(store: Store<T>) => T) => Value): Store<Value> {
  let handles: Cancel[] = [];
  let value: { readonly v: Value } | undefined;

  // value will be calculated just in time
  const s = store({});

  const compute = () => {
    if (!value) {
      value = throws;

      for (const handle of handles) {
        handle();
      }
      handles = [];

      const deps = new Set<Store<any>>();
      value = {
        v: fn((store) => {
          deps.add(store);
          return store.get();
        }),
      };

      for (const store of deps) {
        handles.push(
          store.subscribe(
            () => {
              value = undefined;
              s.set({});
            },
            { runNow: false }
          )
        );
      }
    }

    return value.v;
  };

  return {
    subscribe(listener, options) {
      return s.subscribe(() => listener(compute()), options);
    },

    get() {
      return compute();
    },

    hook: s.hook,
  };
}
