import type { Context, ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { type UseStoreOptions, useStore } from './useStore';
import type { Scope } from '@core';
import type { Store } from '@core/store';
import { createStore } from '@core/store';

export type ScopeProps<T> = { scope: Scope<T>; store?: Store<T>; children?: ReactNode };

const contextMap = new WeakMap<Scope<any>, Context<Store<any>>>();

function getScopeContext<T>(scope: Scope<T>): Context<Store<T>> {
  let context = contextMap.get(scope);

  if (!context) {
    context = createContext<Store<T>>(createStore(scope.defaultValue));
    contextMap.set(scope, context);
  }

  return context;
}

export function ScopeProvider<T>({ scope, store: inputStore, children }: ScopeProps<T>) {
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

export function useScopeStore<T>(scope: Scope<T>, options?: UseStoreOptions): T {
  const store = useScope(scope);
  return useStore(store, options);
}
