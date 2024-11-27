import type { Scope, Selector, Store, Update } from '@core';
import type { Path, Value } from '@lib/path';
import {
  ScopeProvider,
  useScope,
  useScopeProp,
  useScopeStore,
  type ScopeProps,
} from '@react/scope';
import type { UseStoreOptions } from '@react/useStore';

function boundUseScope<T>(this: Scope<T>): Store<T> {
  return useScope(this);
}

function boundUseScopeStore<T, S>(
  this: Scope<T>,
  selector: Selector<T, S>,
  option?: UseStoreOptions<S>,
): S;

function boundUseScopeStore<T, P extends Path<T>>(
  this: Scope<T>,
  selector: P,
  option?: UseStoreOptions<Value<T, P>>,
): Value<T, P>;

function boundUseScopeStore<T>(this: Scope<T>, option?: UseStoreOptions<T>): T;

function boundUseScopeStore(this: Scope<any>, ...args: any[]) {
  return useScopeStore(this, ...args);
}

function boundUseScopeProp<T, S>(
  this: Scope<T>,
  selector: Selector<T, S>,
  updater: (value: S) => Update<T>,
  options?: UseStoreOptions<S>,
): [value: S, setValue: Store<S>['set']];

function boundUseScopeProp<T, P extends Path<T>>(
  this: Scope<T>,
  selector: P,
  options?: UseStoreOptions<Value<T, P>>,
): [value: Value<T, P>, setValue: Store<Value<T, P>>['set']];

function boundUseScopeProp<T>(
  this: Scope<T>,
  options?: UseStoreOptions<T>,
): [value: T, setValue: Store<T>['set']];

function boundUseScopeProp(this: Scope<any>, ...args: any[]) {
  return useScopeProp(this, ...args);
}

function Provider<T>(this: Scope<T>, props: Omit<ScopeProps<T>, 'scope'>): JSX.Element {
  return ScopeProvider({ ...props, scope: this });
}

export const scopeMethods: {
  useScope: typeof boundUseScope;
  useStore: typeof boundUseScopeStore;
  useProp: typeof boundUseScopeProp;
  Provider: typeof Provider;
} = {
  useScope: boundUseScope,
  useStore: boundUseScopeStore,
  useProp: boundUseScopeProp,
  Provider,
};
