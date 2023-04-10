import type { MaybePromise } from './maybePromise';
import { queue } from './queue';
import { trackingProxy } from './trackingProxy';
import { deepEqual } from './equals';
import type { Store } from '@core/store';
import type {
  CalculationHelpers,
  Cancel,
  ConnectionState,
  UpdateFrom,
  Use,
} from '@core/commonTypes';

export class CalculationHelper<T> {
  private current?: {
    cancel: Cancel;
    check: () => void;
    invalidateDependencies: () => void;
  };

  constructor(
    public options: {
      calculate: (helpers: CalculationHelpers<T>) => Cancel | void;
      addEffect: (effect: () => Cancel | void) => Cancel;
      getValue?: () => T | undefined;
      onValue?: (value: T) => void;
      onError?: (error: unknown) => void;
      onConnectionState?: (state: ConnectionState) => void;
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

    const { calculate, addEffect, getValue, onValue, onError, onConnectionState, onInvalidate } =
      this.options;
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

        if (cancelSubscription) {
          cancelSubscription();
          cancelSubscription = undefined;
          cancel();
          onInvalidate?.();
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
        return deepEqual(newValue, value);
      };

      if (!disableProxy) {
        [value, equals] = trackingProxy(value);
      }

      const check = () => equals(store.get());
      let sub: Cancel | undefined;

      const dep = {
        on() {
          this.off();

          sub = store.subscribe(
            () => {
              if (sub && !check()) {
                cancel();
                onInvalidate?.();
              }
            },
            { runNow: false },
          );
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

      checks.push(check);
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
            onError?.(error);
            return;
          }
        }

        if (update instanceof Promise) {
          try {
            update = await update;
          } catch (error) {
            if (!isCancled) {
              onError?.(error);
            }
            return;
          }
        }

        if (!isCancled) {
          onValue?.(update);
        }
      });

    const updateError = (error: unknown) =>
      q(() => {
        if (!isCancled) {
          onError?.(error);
        }
      });

    const updateConnectionState = (state: ConnectionState) =>
      q(() => {
        if (!isCancled) {
          onConnectionState?.(state);
        }
      });

    let cancelSubscription: Cancel | void;
    try {
      cancelSubscription = calculate({ use, updateValue, updateError, updateConnectionState });
    } catch (error) {
      onError?.(error);
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
