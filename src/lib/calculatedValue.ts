import type { AsyncConnectionActions, Cancel, Connection } from '@core/commonTypes';
import type { Store } from '@core/store';
import { Deferred } from '@lib/deferred';
import { queue } from '@lib/queue';
import { deepEqual } from './equals';
import { PromiseWithState } from '@lib/promiseWithState';
import type { Cache } from '@core';

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
          (store as unknown as Cache<any>).state.set('isConnected', false);
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
        connection?.active &&
          q(() => {
            value = _value;
            notify();
          });
      },
      updateValue(update) {
        connection?.active &&
          q(async () => {
            if (update instanceof Function) {
              update = update(await value);
            }

            if (update instanceof Promise) {
              update = await update;
            }

            if (!connection?.active) {
              return;
            }

            value = PromiseWithState.resolve(update) as T;
            notify();
          });
      },
      updateError(error) {
        connection?.active &&
          q(() => {
            (store as unknown as Store<Promise<any>>).set(Promise.reject(error));
          });
      },
      updateIsConnected(isConnected) {
        if (!connection?.active) {
          return;
        }

        if (isConnected) {
          whenConnected.resolve();
        }

        q(() => {
          if ('state' in store) {
            (store as unknown as Cache<any>).state.set('isConnected', isConnected);
          }
        });
      },
      close() {
        connection?.active && store.invalidate();
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

  value =
    store.getter instanceof Function
      ? store.getter({ signal: ac.signal, use, connect })
      : store.getter;

  if (value instanceof Promise) {
    value.finally(() => whenExecuted.resolve()).catch(() => undefined);
  } else {
    whenExecuted.resolve();
  }

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
