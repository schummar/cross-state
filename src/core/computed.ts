import { Store } from '../types';
import { store } from './store';

const Undefined = Symbol('undefined');
const Computing = Symbol('computing');

export function computed<Value>(fn: (use: <T>(store: Store<T>) => T) => Value): Store<Value> {
  let value: Value | typeof Undefined | typeof Computing = Undefined;
  const base = store({});

  const compute = () => {
    if (value === Computing) {
      throw Error('[schummar-state:compute] circular reference in computation!');
    }

    if (value === Undefined) {
      value = Computing;

      const deps = new Set<Store<any>>();
      value = fn((store) => {
        deps.add(store);
        return store.get();
      });

      const handles = [...deps].map((store) =>
        store.subscribe(
          () => {
            for (const handle of handles) {
              handle();
            }

            value = Undefined;
            base.set({});
          },
          { runNow: false }
        )
      );
    }

    return value;
  };

  return {
    ...base,

    subscribe(listener, options) {
      return base.subscribe(() => listener(compute()), options);
    },

    get() {
      return compute();
    },
  };
}
