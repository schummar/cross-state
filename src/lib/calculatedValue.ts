import type { Cancel, Use } from '@core/commonTypes';
import type { Store } from '@core/store';
import { deepEqual } from './equals';

export interface CalculatedValue<T> {
  value: T;
  check: () => void;
  stop(): void;
  invalidateDependencies(recursive?: boolean): void;
}

export function calculatedValue<T>(store: Store<T>): CalculatedValue<T> {
  let active = false;
  const deps = new Array<{ store: Store<any>; value: any; on: () => void; off: () => void }>();

  const cancelEffect = store.addEffect(() => {
    active = true;

    for (const dep of deps) {
      dep.on();
    }

    return () => {
      active = false;

      for (const dep of deps) {
        dep.off();
      }
    };
  });

  const use: Use = (dep) => {
    const value = dep.get();
    let cancel: Cancel | undefined;

    const on = () => {
      cancel ||= dep.subscribe(() => store.invalidate(), { runNow: false });
    };

    const off = () => {
      cancel?.();
      cancel = undefined;
    };

    deps.push({ store: dep, value, on, off });

    if (active) {
      on();
    }

    return value;
  };

  const value = store.getter instanceof Function ? store.getter({ use }) : store.getter;

  function check() {
    if (active) {
      return;
    }

    for (const dep of deps) {
      if (!deepEqual(dep.store.get(), dep.value)) {
        store.invalidate();
        return;
      }
    }
  }

  function stop() {
    cancelEffect();
  }

  function invalidateDependencies(recursive?: boolean) {
    for (const dep of deps) {
      dep.store.invalidate(recursive);
    }
  }

  return { value, check, stop, invalidateDependencies };
}

export function staticValue<T>(value: T): CalculatedValue<T> {
  return {
    value,
    check: () => undefined,
    stop: () => undefined,
    invalidateDependencies: () => undefined,
  };
}
