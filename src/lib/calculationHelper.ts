import type { Cancel, Use } from '@core/commonTypes';
import type { Store } from '@core/store';
import { trackingProxy } from './trackingProxy';

export function calculationHelper<T>(
  store: Store<any>,
  calculate: (fns: { use: Use }) => T,
  callbacks: {
    onInvalidate: () => void;
  }
) {
  const checks = new Array<() => boolean>();
  const deps = new Set<Store<any>>();
  const subs = new Array<Cancel>();

  const cancelEffect = store.addEffect(() => {
    for (const store of deps) {
      const sub = store.sub(checkValidity, { runNow: false });
      subs.push(sub);
    }

    return () => {
      subs.forEach((handle) => handle());
      subs.length = 0;
    };
  });

  const checkValidity = () => {
    if (!checks.every((check) => check())) {
      callbacks.onInvalidate();
    }
  };

  const cleanupExecute = () => {
    cancelEffect();
    delete this.checkValidity;
    delete this.cleanupExecute;
    subs.forEach((handle) => handle());
  };

  const use: Use = (store, { disableProxy } = {}) => {
    let value = store.get();
    let equals = (newValue: any) => newValue === value;

    if (!disableProxy) {
      [value, equals] = trackingProxy(value);
    }

    checks.push(() => equals(store.get()));
    deps.add(store);

    if (store.isActive && (!promise || promise === this.get().promise)) {
      const sub = store.sub(checkValidity, { runNow: false });
      subs.push(sub);
    }

    return value;
  };
}
