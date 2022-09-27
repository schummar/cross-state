import type { Cancel, Listener } from './commonTypes';

interface Subscribe<T> {
  (listener: Listener<T>, options: { runNow?: boolean }): Cancel;
}

export function once<T, S extends T>(subscribe: Subscribe<T>, condition: (value: T) => value is S): Promise<S>;
export function once<T>(subscribe: Subscribe<T>, condition?: (value: T) => boolean): Promise<T>;
export function once<T>(subscribe: Subscribe<T>, condition?: (value: T) => boolean) {
  return new Promise<T>((resolve) => {
    const cancel = subscribe(
      (value) => {
        if (condition && !condition(value)) {
          return;
        }

        resolve(value);
        setTimeout(() => cancel());
      },
      {
        runNow: !!condition,
      }
    );
  });
}
