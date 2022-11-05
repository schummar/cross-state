import type { MaybePromise } from './maybePromise';

type Action<T> = () => MaybePromise<T>;

export interface Queue {
  <T>(action: Action<T>): Promise<T>;
  clear: () => void;
  whenDone: Promise<void>;
}

export function queue(): Queue {
  const q: { action: Action<any>; resolve: (value: any) => void; reject: (error: unknown) => void }[] = [];
  let promise: Promise<void> | undefined, resolve: (() => void) | undefined;
  let active = false;

  const run = async () => {
    if (!active) {
      active = true;

      let next;
      while ((next = q.shift())) {
        try {
          let result = next.action();
          if (result instanceof Promise) {
            result = await result;
          }
          next.resolve(result);
        } catch (e) {
          next.reject(e);
        }
      }

      active = false;
      resolve?.();
    }
  };

  return Object.assign(
    <T>(action: Action<T>) => {
      return new Promise<T>((resolve, reject) => {
        q.push({ action, resolve, reject });
        run();
      });
    },
    {
      clear() {
        q.length = 0;
        resolve?.();
      },

      get whenDone() {
        if (!promise) {
          promise = new Promise<void>((r) => {
            resolve = () => {
              promise = undefined;
              resolve = undefined;
              r();
            };
          });
        }

        return promise;
      },
    }
  );
}
