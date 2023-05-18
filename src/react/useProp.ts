import type { UseStoreOptions } from './useStore';
import { useStore } from './useStore';
import { type Selector, type Update } from '@core/commonTypes';
import type { Store } from '@core/store';
import { type Path, type Value } from '@lib/path';

export function useProp<T, S>(
  store: Store<T>,
  selector: Selector<T, S>,
  updater: (value: S) => Update<T>,
  options?: UseStoreOptions,
): [value: S, setValue: Store<S>['set']];

export function useProp<T, P extends Path<T>>(
  store: Store<T>,
  selector: P,
  options?: UseStoreOptions,
): [value: Value<T, P>, setValue: Store<Value<T, P>>['set']];

export function useProp<T>(
  store: Store<T>,
  options?: UseStoreOptions,
): [value: T, setValue: Store<T>['set']];

export function useProp<T, S>(
  store: Store<T>,
  argument1?: any,
  argument2?: any,
  argument3?: any,
): [value: S, setValue: Store<S>['set']] {
  const selector =
    typeof argument1 === 'function' || typeof argument1 === 'string' ? argument1 : undefined;
  const updater = typeof argument2 === 'function' ? argument2 : undefined;
  const options =
    typeof argument1 === 'object'
      ? argument1
      : typeof argument2 === 'object'
      ? argument2
      : argument3;

  if (selector) {
    store = store.map(selector, updater);
  }

  const value = useStore(store, options) as S;
  return [value, store.set as Store<S>['set']];
}
