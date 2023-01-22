import type { Path } from './path';
import { get } from './propAccess';

export function makeSelector<T, S>(selector?: ((value: T) => S) | Path<any>): (value: T) => S {
  if (!selector) {
    return (x) => x as any;
  }

  if (selector instanceof Function) {
    return selector;
  }

  return (x) => get(x, selector as any) as any;
}
