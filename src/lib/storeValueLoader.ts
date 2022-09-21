import type { Cancel } from '../core/commonTypes';
import type { ConnectFn, HelperFns, StoreCache, StoreValue, UseFn } from '../core/store';

export function storeValueLoader<T>(getState: T | ((this: HelperFns, fn: HelperFns) => T)): StoreCache<T> {
  let value, cancel;

  if (getState instanceof Function) {
    const stopped = false;
    const handles = new Array<Cancel>();
    const checks = new Array<() => boolean>();

    const use: UseFn = (store) => {
      if (!stopped) {
        const cancel = store.subscribe(this.invalidate);
        handles.add(cancel);
      }

      const value = store.get();
      checks.push(() => store.get() === value);
      return value;
    };

    const connect: ConnectFn = () => {
      // ignore
    };

    value = this.getState.apply({ use, connect }, [{ use, connect }]);
  } else {
    value = this.getState;
  }

  if (value instanceof Promise) {
    value = Object.assign(value, {
      state: 'pending',
    });
  }

  return { value: value as StoreValue<T>, deps: new Set(), checks: [] };
}
