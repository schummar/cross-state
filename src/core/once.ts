import type { Cancel, Listener } from './commonTypes';

interface Subscribe<T> {
  (listener: Listener<T>, options?: { runNow?: boolean }): Cancel;
}

export function once<T, S extends T>(
  subscribe: Subscribe<T>,
  condition: (value: T) => value is S,
): Promise<S>;
export function once<T>(subscribe: Subscribe<T>, condition?: (value: T) => boolean): Promise<T>;
export function once<T>(subscribe: Subscribe<T>, condition?: (value: T) => boolean) {
  return new Promise<T>((resolve) => {
    let stopped = false;
    const cancel = subscribe(
      (value) => {
        if (stopped || (condition && !condition(value))) {
          return;
        }

        resolve(value);
        stopped = true;
        setTimeout(() => cancel());
      },
      {
        runNow: !!condition,
      },
    );
  });
}

export function onceValue<T>(subscribe: Subscribe<{ value?: T; error?: unknown }>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let stopped = false;
    const cancel = subscribe(({ value, error }) => {
      if (stopped || (value === undefined && error === undefined)) {
        return;
      }

      if (value !== undefined) {
        resolve(value);
      } else {
        reject(error);
      }

      stopped = true;
      setTimeout(() => cancel());
    });
  });
}
