import type { MaybePromise } from './maybePromise';

type Action<T> = () => T | Promise<T>;
interface Queue {
  <T>(action: Action<T>): MaybePromise<T>;
  clear: () => void;
}

export function queue(): Queue {
  const q: { action: Action<any>; resolve: (value: any) => void; reject: (error: unknown) => void }[] = [];
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
      },
    }
  );
}
