import { StoreSubDetails, StoreSubValue } from '../core/store';
import { get } from './propAccess';

export function makeSelector<T, G, S>(
  selector?: ((value: StoreSubValue<T, G>, state: StoreSubDetails<T, G>) => any) | string
): (value: StoreSubValue<T, G>, state: StoreSubDetails<T, G>) => S {
  if (!selector) {
    return (x) => x as any;
  }

  if (selector instanceof Function) {
    return selector;
  }

  return (x) => get(x, selector as any) as any;
}
