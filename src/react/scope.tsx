import type { Context, ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { useProp } from './useProp';
import { useStore, type UseStoreOptions } from './useStore';
import { createStore } from '@core/store';
import type { Store } from '@core/store';
import type { Scope } from '@core';

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
}: ScopeProps<T>): JSX.Element {
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

export function useScopeStore<T>(scope: Scope<T>, options?: UseStoreOptions<T>): T {
  const store = useScope(scope);
  return useStore(store, options);
}

export function useScopeProp<T>(
  scope: Scope<T>,
  options?: UseStoreOptions<T>,
): [value: T, setValue: Store<T>['set']] {
  const store = useScope(scope);
  return useProp(store, options);
}
