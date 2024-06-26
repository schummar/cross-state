import isPromise from '@lib/isPromise';
import type { MaybePromise } from './maybePromise';
import type { Listener } from '@core';

type Action<T> = () => MaybePromise<T>;

export interface Queue {
  <T>(action: Action<T>, ref?: any): Promise<T>;
  clear: () => void;
  whenDone: () => Promise<void>;
  size: number;
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
          if (isPromise(result)) {
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

      get size() {
        return q.length;
      },

      getRefs() {
        return q.map((item) => item.ref).filter((x) => x !== undefined);
      },
    },
  );
}
