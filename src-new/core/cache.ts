import { Store } from '../types';
import { async } from './async';

export function cache<Args extends any[], S extends Store<any>>(factory: (...args: Args) => S): (...args: Args) => S {
  const cache = new Map<string, S>();

  return (...args) => {};
}

const foo = cache((x: number, y: string) => async(() => 42));
const foo1 = foo(1, 's');
foo1.subscribe;
