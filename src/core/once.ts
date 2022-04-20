import type { Store } from './types';

export function once<T, S extends T>(store: Store<T>, condition: (value: T) => value is S): Promise<S>;
export function once<T>(store: Store<T>, condition?: (value: T) => boolean): Promise<T>;
export function once<T>(store: Store<T>, condition?: (value: T) => boolean) {
  return new Promise<T>((resolve) => {
    const cancel = store.subscribe(
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
