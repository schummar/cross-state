import type { AnyPath } from './path';
import { get } from './propAccess';

function identity<T>(x: T): T {
  return x;
}

export function makeSelector<T, S>(selector?: ((value: T) => S) | AnyPath): (value: T) => S {
  if (!selector) {
    return identity as (value: T) => S;
  }

  if (selector instanceof Function) {
    return selector;
  }

  return (x) => get(x, selector as any) as any;
}
