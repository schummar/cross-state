import type { MaybePromise } from './maybePromise';

export function maybeAsync<T, R>(
  value: MaybePromise<T>,
  action: (value: T) => MaybePromise<R>,
): MaybePromise<R> {
  if (value instanceof Promise) {
    return value.then(action);
  }
  return action(value);
}

export function maybeAsyncArray<T>(values: (() => MaybePromise<T>)[]): MaybePromise<T[]> {
  const run = (remainingValues: (() => MaybePromise<T>)[], results: T[]): MaybePromise<T[]> => {
    const [first, ...rest] = remainingValues;
    if (!first) {
      return results;
    }

    return maybeAsync(first(), (result) => run(rest, results.concat(result)));
  };

  return run(values, []);
}
