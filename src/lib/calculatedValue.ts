import type { AsyncConnectionActions, Cancel, Connection } from '@core/commonTypes';
import type { Store } from '@core/store';
import { Deferred } from '@lib/deferred';
import { queue } from '@lib/queue';
import { deepEqual } from './equals';
import { PromiseWithState } from '@lib/promiseWithState';

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
  let cancelConnection: Cancel | undefined;
  const q = queue();
  q(() => whenExecuted);

  const cancelEffect = store.addEffect(() => {
    if (cancelConnection) {
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

      cancelConnection?.();
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

  async function connect(connection: Connection<T>) {
    if (!active) {
      return;
    }

    const actions: AsyncConnectionActions<any> = {
      set(value) {
        q(() => {
          store.set(value);
        });
      },
      updateValue(update) {
        q(async () => {
          if (update instanceof Function) {
            update = update(await value);
          }

          value = PromiseWithState.resolve(update) as T;
          notify();
        });
      },
      updateError(error) {
        q(() => {
          (store as unknown as Store<Promise<any>>).set(Promise.reject(error));
        });
      },
      updateIsConnected(isConnected) {
        if (isConnected) {
          whenConnected.resolve();
        }
      },
      close() {
        store.invalidate();
      },
    };

    cancelConnection = connection(actions as any);
    return whenConnected;
  }

  value = store.getter instanceof Function ? store.getter({ use, connect }) : store.getter;

  if (value instanceof Promise) {
    value.finally(() => whenExecuted.resolve()).catch(() => undefined);
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
    cancelConnection?.();
    if (cancelConnection) {
      whenConnected.reject();
      whenExecuted.reject();
    } else {
      whenConnected.resolve();
      whenExecuted.resolve();
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
