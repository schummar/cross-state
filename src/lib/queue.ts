import type { MaybePromise } from './maybePromise';
import type { Listener } from '@core';

type Action<T> = () => MaybePromise<T>;

export interface Queue {
  <T>(action: Action<T>, ref?: any): Promise<T>;
  clear: () => void;
  whenDone: () => Promise<void>;
  getRefs: () => any[];
}

export function queue(): Queue {
  const q: {
    action: Action<any>;
    resolve: (value: any) => void;
    reject: (error: unknown) => void;
    ref?: any;
  }[] = [];
  const completionListeners = new Set<Listener<void>>();
  let active = false;

  const notify = () => {
    for (const listener of completionListeners) {
      listener();
    }

    completionListeners.clear();
  };

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
        } catch (error) {
          next.reject(error);
        }
      }

      active = false;
      notify();
    }
  };

  return Object.assign(
    <T>(action: Action<T>, ref?: any) => {
      return new Promise<T>((resolve, reject) => {
        q.push({ action, resolve, reject, ref });
        run();
      });
    },
    {
      clear() {
        q.length = 0;
      },

      whenDone() {
        if (!active) {
          return Promise.resolve();
        }

        return new Promise<void>((resolve) => {
          completionListeners.add(resolve);
        });
      },

      getRefs() {
        return q.map((item) => item.ref).filter((x) => x !== undefined);
      },
    },
  );
}
