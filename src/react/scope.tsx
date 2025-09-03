import type { Scope, Selector, Update } from '@core';
import { createStore, type Store } from '@core/store';
import type { Constrain } from '@lib/constrain';
import type { Path, Value } from '@lib/path';
import { createContext, useContext, useMemo, type Context, type ReactNode } from 'react';
import { useProp } from './useProp';
import { useStore, type UseStoreOptions } from './useStore';

export type ScopeProps<T> = { scope: Scope<T>; store?: Store<T>; children?: ReactNode };

declare module '@core' {
  interface Scope<T> {
    context?: Context<Store<T>>;
  }
}

function getScopeContext<T>(scope: Scope<T>): Context<Store<T>> {
  scope.context ??= createContext<Store<T>>(createStore(scope.defaultValue));
  return scope.context;
}

export function ScopeProvider<T>({
  scope,
  store: inputStore,
  children,
}: ScopeProps<T>): React.JSX.Element {
  const context = getScopeContext(scope);
  const currentStore = useMemo(
    () => inputStore ?? createStore(scope.defaultValue),
    [scope, inputStore],
  );

  return <context.Provider value={currentStore}>{children}</context.Provider>;
}

export function useScope<T>(scope: Scope<T>): Store<T> {
  const context = getScopeContext(scope);
  return useContext(context);
}

export function useScopeStore<T, S>(
  scope: Scope<T>,
  selector: Selector<T, S>,
  option?: UseStoreOptions<S>,
): S;

export function useScopeStore<T, const P>(
  scope: Scope<T>,
  selector: Constrain<P, Path<T>>,
  option?: UseStoreOptions<Value<T, P>>,
): Value<T, P>;

export function useScopeStore<T>(scope: Scope<T>, option?: UseStoreOptions<T>): T;

export function useScopeStore<T>(scope: Scope<T>, ...args: any[]): T {
  const store = useScope(scope);
  return useStore(store, ...args);
}

export function useScopeProp<T, S>(
  scope: Scope<T>,
  selector: Selector<T, S>,
  updater: (value: S) => Update<T>,
  options?: UseStoreOptions<S>,
): [value: S, setValue: Store<S>['set']];

export function useScopeProp<T, const P>(
  scope: Scope<T>,
  selector: Constrain<P, Path<T>>,
  options?: UseStoreOptions<Value<T, P>>,
): [value: Value<T, P>, setValue: Store<Value<T, P>>['set']];

export function useScopeProp<T>(
  scope: Scope<T>,
  options?: UseStoreOptions<T>,
): [value: T, setValue: Store<T>['set']];

export function useScopeProp<T>(
  scope: Scope<T>,
  ...args: any[]
): [value: T, setValue: Store<T>['set']] {
  const store = useScope(scope);
  return useProp(store, ...args);
}
