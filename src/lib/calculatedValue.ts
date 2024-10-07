import type { Cache } from '@core';
import type { AsyncConnectionActions, Cancel, Connection } from '@core/commonTypes';
import type { Store } from '@core/store';
import { Deferred } from '@lib/deferred';
import isPromise from '@lib/isPromise';
import { PromiseWithState } from '@lib/promiseWithState';
import { queue } from '@lib/queue';
import { deepEqual } from './equals';

export interface CalculatedValue<T> {
  value: T;
  check: () => void;
  stop(): void;
  invalidateDependencies(recursive?: boolean): void;
}

export function calculatedValue<T>(store: Store<T>, notify: () => void): CalculatedValue<T> {
  let active = false;
  const deps = new Array<{ store: Store<any>; value: any; on: () => void; off: () => void }>();
  let value: T | undefined;
  const whenConnected = new Deferred();
  const whenExecuted = new Deferred();
  const ac = new AbortController();
  let connection: { active: boolean; cancel?: Cancel } | undefined;
  const q = queue();
  q(() => whenExecuted);

  const cancelEffect = store.addEffect(() => {
    if (connection) {
      store.invalidate();
      return;
    }

    active = true;

    for (const dep of deps) {
      dep.on();
    }

    return () => {
      active = false;

      for (const dep of deps) {
        dep.off();
      }

      if (connection) {
        connection.active = false;
        connection.cancel?.();
        q.clear();

        if ('state' in store) {
          (store as unknown as Cache<any>).state.set((state) => ({
            ...state,
            isConnected: false,
            isStale: true,
          }));
        }
      }
    };
  });

  function use<S>(dep: Store<S>) {
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
  }

  async function connect(createConnection: Connection<T>) {
    if (!active) {
      connection = { active: false };
      return;
    }

    const actions: AsyncConnectionActions<any> = {
      set(_value) {
        q(() => {
          if (!connection?.active) {
            return;
          }

          value = _value;
          notify();
        });
      },
      updateValue(update) {
        q(async () => {
          if (!connection?.active) {
            return;
          }

          if (update instanceof Function) {
            const currentValue = await value;

            if (!connection?.active) {
              return;
            }

            try {
              update = update(currentValue);
            } catch (error) {
              value = PromiseWithState.reject(error) as T;
              notify();
              connection.active = false;
              connection.cancel?.();
              return;
            }
          }

          value = PromiseWithState.resolve(update) as T;
          notify();
        });
      },
      updateError(error) {
        q(() => {
          if (!connection?.active) {
            return;
          }

          connection.active = false;
          connection.cancel?.();

          if ('state' in store) {
            (store as unknown as Cache<any>).state.set({
              status: 'error',
              error,
              isConnected: false,
              isUpdating: false,
              isStale: false,
            });
          }

          value = PromiseWithState.reject(error) as T;
          notify();
        });
      },
      updateIsConnected(isConnected) {
        if (isConnected) {
          whenConnected.resolve();
        }

        q(() => {
          if (!connection?.active) {
            return;
          }

          if ('state' in store) {
            (store as unknown as Cache<any>).state.set('isConnected', isConnected);
          }
        });
      },
      close() {
        if (connection?.active) {
          store.invalidate();
        }
      },
    };

    connection = { active: true };
    let _cancel: Cancel | undefined = createConnection(actions as any);

    connection.cancel = () => {
      _cancel?.();
      _cancel = undefined;
    };

    if (!connection.active) {
      connection.cancel();
    }

    return whenConnected;
  }

  if (store.getter instanceof Function) {
    try {
      value = store.getter({ signal: ac.signal, use, connect });
    } catch (error) {
      value = PromiseWithState.reject(error) as T;

      if (connection) {
        connection.active = false;
        connection.cancel?.();
        q.clear();
      }
    }
  } else {
    value = store.getter;
  }

  if (isPromise(value)) {
    value.finally(() => whenExecuted.resolve()).catch(() => undefined);
  } else {
    whenExecuted.resolve();
  }

  function check() {
    for (const dep of deps) {
      if (!deepEqual(dep.store.get(), dep.value)) {
        store.invalidate();
        return;
      }
    }
  }

  function stop() {
    cancelEffect();
    whenExecuted.resolve();
    whenConnected.resolve();
    ac.abort();

    if (connection) {
      connection.active = false;
      connection.cancel?.();
      q.clear();
    }
  }

  function invalidateDependencies(recursive?: boolean) {
    for (const dep of deps) {
      dep.store.invalidate(recursive);
    }
  }

  return {
    get value() {
      return value!;
    },
    check,
    stop,
    invalidateDependencies,
  };
}

export function staticValue<T>(value: T): CalculatedValue<T> {
  return {
    value,
    check: () => undefined,
    stop: () => undefined,
    invalidateDependencies: () => undefined,
  };
}
