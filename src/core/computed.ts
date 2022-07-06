import { atomicStore } from './atomicStore';
import type { Duration, Effect, Listener, Store, SubscribeOptions } from './types';

export type Computed<Value> = ComputedImpl<Value>;

const Undefined = Symbol('undefined');
const Computing = Symbol('computing');

class ComputedImpl<Value> implements Store<Value> {
  private value: Value | typeof Undefined | typeof Computing = Undefined;
  private internalStore = atomicStore({});

  constructor(private readonly fn: (use: <T>(store: Store<T>) => T) => Value) {}

  get() {
    return this.compute();
  }

  subscribe(listener: Listener<Value>, options: SubscribeOptions) {
    return this.internalStore.subscribe(() => listener(this.compute()), options);
  }

  addEffect(effect: Effect, retain?: Duration | undefined) {
    return this.internalStore.addEffect(effect, retain);
  }

  isActive() {
    return this.internalStore.isActive();
  }

  recreate(): this {
    return new ComputedImpl(this.fn) as this;
  }

  private compute() {
    if (this.value === Computing) {
      throw Error('[schummar-state:compute] circular reference in computation!');
    }

    if (this.value === Undefined) {
      this.value = Computing;

      const deps = new Set<Store<any>>();
      this.value = this.fn((store) => {
        deps.add(store);
        return store.get();
      });

      const handles = [...deps].map((store) =>
        store.subscribe(
          () => {
            for (const handle of handles) {
              handle();
            }

            this.value = Undefined;
            this.internalStore.set({});
          },
          { runNow: false }
        )
      );
    }

    return this.value;
  }
}

export function computed<Value>(fn: (use: <T>(store: Store<T>) => T) => Value): Store<Value> {
  return new ComputedImpl(fn);
}
