import type { CacheState } from './cacheState';

export type TrackedPromise<T> = Promise<T> & CacheState<T>;

export function trackPromise<T>(promise: Promise<T>): TrackedPromise<T> {
  if (isTrackedPromise(promise)) {
    return promise;
  }

  const promiseWithState = Object.assign<Promise<T>, CacheState<T>>(promise, {
    status: 'pending',
  });

  promise.then(
    (value) => {
      Object.assign(promiseWithState, {
        status: 'value',
        value,
      });
      delete promiseWithState.error;
    },
    (error) => {
      Object.assign(promiseWithState, {
        status: 'error',
        error,
      });
      delete promiseWithState.value;
    },
  );

  return promiseWithState;
}

export function isTrackedPromise<T>(value: Promise<T>): value is TrackedPromise<T> {
  return 'status' in value;
}
