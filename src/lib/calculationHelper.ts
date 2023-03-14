import type { MaybePromise } from './maybePromise';
import { queue } from './queue';
import { trackingProxy } from './trackingProxy';
import type { Store } from '@core/store';
import type { CalculationHelpers, Cancel, UpdateFrom, Use } from '@core/commonTypes';

export class CalculationHelper<T> {
  private current?: {
    cancel: Cancel;
    check: () => void;
    invalidateDependencies: () => void;
  };

  constructor(
    private options: {
      calculate: (helpers: CalculationHelpers<T>) => Cancel | void;
      addEffect: (effect: () => Cancel | void) => Cancel;
      getValue?: () => T | undefined;
      setValue?: (value: T) => void;
      setError?: (error: unknown) => void;
      onInvalidate?: () => void;
    },
  ) {
    options.addEffect(() => {
      if (this.current) {
        this.current.check();
      } else {
        this.execute();
      }
    });
  }

  execute() {
    this.stop();

    const { calculate, addEffect, getValue, setValue, setError, onInvalidate } = this.options;
    const checks = new Array<() => boolean>();
    const deps = new Map<Store<any>, { on: () => void; off: () => void; invalidate: () => void }>();
    const q = queue();
    let isActive = false;
    let isCancled = false;

    const cancelEffect = addEffect(() => {
      isActive = true;

      for (const dep of deps.values()) {
        dep.on();
      }

      return () => {
        isActive = false;

        for (const dep of deps.values()) {
          dep.off();
        }
      };
    });

    const cancel = () => {
      isCancled = true;
      cancelSubscription?.();
      cancelEffect();
      delete this.current;
    };

    const checkAll = () => {
      if (!checks.every((check) => check())) {
        cancel();
        onInvalidate?.();
      }
    };

    const invalidateDependencies = () => {
      for (const dep of deps.values()) {
        dep.invalidate();
      }
    };

    const use: Use = (store, { disableProxy } = {}) => {
      if (isCancled) {
        return store.get();
      }

      let value = store.get();
      let equals = (newValue: any) => {
        return newValue === value;
      };

      if (!disableProxy) {
        [value, equals] = trackingProxy(value);
      }

      let sub: Cancel | undefined;

      const dep = {
        on() {
          this.off();

          sub = store.sub(checkAll, { runNow: false });
        },
        off() {
          sub?.();
          sub = undefined;
        },
        invalidate() {
          if ('invalidate' in store && store.invalidate instanceof Function) {
            store.invalidate();
          }
        },
      };

      if (isActive) {
        dep.on();
      }

      checks.push(() => equals(store.get()));
      deps.set(store, dep);

      return value;
    };

    const updateValue = (update: UpdateFrom<MaybePromise<T>, [T | undefined]>) =>
      q(async () => {
        if (isCancled) {
          return;
        }

        if (update instanceof Function) {
          try {
            update = update(getValue?.());
          } catch (error) {
            setError?.(error);
            return;
          }
        }

        if (update instanceof Promise) {
          try {
            update = await update;
          } catch (error) {
            if (!isCancled) {
              setError?.(error);
            }
            return;
          }
        }

        if (!isCancled) {
          setValue?.(update);
        }
      });

    const updateError = (error: unknown) =>
      q(() => {
        if (!isCancled) {
          setError?.(error);
        }
      });

    let cancelSubscription: Cancel | void;
    try {
      cancelSubscription = calculate({ use, updateValue, updateError });
    } catch (error) {
      setError?.(error);
    }

    this.current = { cancel, check: checkAll, invalidateDependencies };
  }

  stop() {
    this.current?.cancel();
  }

  check() {
    this.current?.check();
  }

  checkOrExecute() {
    if (this.current) {
      this.check();
    } else {
      this.execute();
    }
  }

  invalidateDependencies() {
    this.current?.invalidateDependencies();
  }
}
