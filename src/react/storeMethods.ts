import type { Selector, Store, Update } from '@core';
import type { Constrain } from '@lib/constrain';
import type { Path, Value } from '@lib/path';
import { useProp } from '@react/useProp';
import { type UseStoreOptions, useStore } from '@react/useStore';

function boundUseStore<T, S>(
  this: Store<T>,
  selector: Selector<T, S>,
  option?: UseStoreOptions<S>,
): S;
function boundUseStore<T, const P>(
  this: Store<T>,
  selector: Constrain<P, Path<T>>,
  option?: UseStoreOptions<Value<T, P>>,
): Value<T, P>;
function boundUseStore<T>(this: Store<T>, option?: UseStoreOptions<T>): T;
function boundUseStore(this: Store<any>, ...args: any[]) {
  return useStore(this, ...args);
}

function boundUseProp<T, S>(
  this: Store<T>,
  selector: Selector<T, S>,
  updater: (value: S) => Update<T>,
  options?: UseStoreOptions<S>,
): [value: S, setValue: Store<S>['set']];
function boundUseProp<T, const P>(
  this: Store<T>,
  selector: Constrain<P, Path<T>>,
  options?: UseStoreOptions<Value<T, P>>,
): [value: Value<T, P>, setValue: Store<Value<T, P>>['set']];
function boundUseProp<T>(
  this: Store<T>,
  options?: UseStoreOptions<T>,
): [value: T, setValue: Store<T>['set']];
function boundUseProp(this: Store<any>, ...args: any[]) {
  return useProp(this, ...args);
}

export const storeMethods: {
  useStore: typeof boundUseStore;
  useProp: typeof boundUseProp;
} = {
  useStore: boundUseStore,
  useProp: boundUseProp,
};
