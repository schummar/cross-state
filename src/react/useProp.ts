import { type Selector, type Update } from '@core/commonTypes';
import type { Store } from '@core/store';
import type { Constrain } from '@lib/constrain';
import { isAnyPath, type AnyPath, type SettablePath, type Value } from '@lib/path';
import useLatestFunction from '@react/lib/useLatestFunction';
import { useStore, type UseStoreOptions } from './useStore';

export function useProp<T, S>(
  store: Store<T>,
  selector: Selector<T, S>,
  updater: (value: S) => Update<T>,
  options?: UseStoreOptions<S>,
): [value: S, setValue: Store<S>['set']];

export function useProp<T, const P>(
  store: Store<T>,
  selector: Constrain<P, SettablePath<T>>,
  options?: UseStoreOptions<Value<T, P>>,
): [value: Value<T, P>, setValue: Store<Value<T, P>>['set']];

export function useProp<T>(
  store: Store<T>,
  options?: UseStoreOptions<T>,
): [value: T, setValue: Store<T>['set']];

export function useProp<T, S>(
  store: Store<T>,
  ...args:
    | [Selector<T, S>, (value: S) => Update<T>, UseStoreOptions<S>?]
    | [AnyPath, UseStoreOptions<Value<T, any>>?]
    | [UseStoreOptions<S>?]
): [value: S, setValue: Store<S>['set']] {
  let selector: Selector<T, S> | AnyPath | undefined;
  let updater: ((value: S) => Update<T>) | undefined;
  let options: UseStoreOptions<S> | undefined;

  if (typeof args[0] === 'function' || isAnyPath(args[0])) {
    selector = args[0];
    if (typeof args[1] === 'function') {
      updater = args[1];
      options = args[2];
    } else {
      options = args[1];
    }
  } else {
    options = args[0];
  }

  const value = useStore(store, (selector ?? ((x) => x)) as Selector<T, S>, options);

  const update = useLatestFunction((update) => {
    let _store: Store<any> = store;
    if (selector) {
      _store = _store.map(selector as Selector<any, any>, updater);
    }

    _store.set(update);
  });

  return [value, update];
}
