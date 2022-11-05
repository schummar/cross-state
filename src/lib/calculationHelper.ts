import type { Cancel, Update, UpdateFrom, Use } from '@core/commonTypes';
import type { Store } from '@core/store';
import type { MaybePromise } from './maybePromise';
import { queue } from './queue';
import { trackingProxy } from './trackingProxy';

export function calculationHelper<T>(
  store: Store<T>,
  calculate: (fns: {
    use: Use;
    updateValue: (update: UpdateFrom<MaybePromise<T>, [T | undefined]>) => void;
    updateError: (error: unknown) => void;
  }) => T,
  callbacks: {
    setError: (error: unknown) => void;
    onInvalidate: () => void;
  }
) {
  const checks = new Array<() => boolean>();
  const deps = new Map<Store<any>, Cancel | undefined>();
  const q = queue();
  let isCanceled = false;

  const use: Use = (dep, { disableProxy } = {}) => {
    if (isCanceled) {
      return dep.get();
    }

    let value = dep.get();
    let equals = (newValue: any) => newValue === value;

    if (!disableProxy) {
      [value, equals] = trackingProxy(value);
    }

    let sub;
    if (store.isActive) {
      sub = dep.sub(checkValidity, { runNow: false });
    }

    checks.push(() => equals(dep.get()));
    deps.set(dep, sub);

    return value;
  };

  const updateValue = (update: UpdateFrom<MaybePromise<T>, [T | undefined]>) =>
    q(async () => {
      if (isCanceled) {
        return;
      }

      if (update instanceof Function) {
        try {
          update = update(store.get());
        } catch (error) {
          callbacks.setError(error);
          return;
        }
      }

      if (update instanceof Promise) {
        try {
          update = await update;
        } catch (error) {
          if (!isCanceled) {
            callbacks.setError(error);
          }
          return;
        }
      }

      if (isCanceled) {
        return;
      }

      store.set(update);
    });

  const updateError = (error: unknown) =>
    q(() => {
      callbacks.setError(error);
    });

  const checkValidity = () => {
    if (!checks.every((check) => check())) {
      callbacks.onInvalidate();
    }
  };

  const cancelEffect = store.addEffect(() => {
    for (const dep of deps.keys()) {
      const sub = dep.sub(checkValidity, { runNow: false });
      deps.set(dep, sub);
    }

    return () => {
      for (const [dep, sub] of deps.entries()) {
        sub?.();
        deps.set(dep, undefined);
      }
    };
  });

  const cancel = () => {
    cancelEffect();
    isCanceled = true;

    for (const sub of deps.values()) {
      sub?.();
    }
  };

  return { cancel };
}
