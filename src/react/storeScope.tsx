import type { Context, ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import type { Store } from '@core/store';
import { createStore } from '@core/store';
import type { StoreScope } from '@core/storeScope';

export type StoreScopeProps<T> = { scope: StoreScope<T>; store?: Store<T>; children?: ReactNode };

export const contextMap = new WeakMap<StoreScope<any>, Context<Store<any>>>();

export function getStoreScopeContext<T>(scope: StoreScope<T>): Context<Store<T>> {
  let context = contextMap.get(scope);

  if (!context) {
    context = createContext<Store<T>>(createStore(scope.defaultValue));
    contextMap.set(scope, context);
  }

  return context;
}

export function StoreScopeProvider<T>({ scope, store: inputStore, children }: StoreScopeProps<T>) {
  const context = getStoreScopeContext(scope);
  const currentStore = useMemo(
    () => inputStore ?? createStore(scope.defaultValue),
    [scope, inputStore],
  );

  return <context.Provider value={currentStore}>{children}</context.Provider>;
}

export function useStoreScope<T>(scope: StoreScope<T>): Store<T> {
  const context = getStoreScopeContext(scope);
  return useContext(context);
}
