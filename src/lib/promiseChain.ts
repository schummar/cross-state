import isPromise from '@lib/isPromise';

export interface Chain<T> {
  value: T;
  next<S>(fn: (value: Awaited<T>) => S): T extends Promise<any> ? Chain<Promise<S>> : Chain<S>;
}

export default function promiseChain<T>(value: T | (() => T)): Chain<T> {
  if (value instanceof Function) {
    value = value();
  }

  return {
    value,
    next(fn) {
      const next = isPromise(value)
        ? value.then((value) => fn(value as Awaited<T>))
        : fn(value as Awaited<T>);

      return promiseChain(next) as any;
    },
  };
}
