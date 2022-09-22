import { get } from './propAccess';

export function makeSelector<V, S>(selector?: ((...args: any[]) => any) | string): (value: V) => S {
  if (!selector) {
    return (x) => x as any;
  }

  if (selector instanceof Function) {
    return selector;
  }

  return (x) => get(x, selector as any) as any;
}
