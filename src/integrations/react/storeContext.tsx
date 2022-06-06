import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { store } from '../../core/store';
import type { BaseStore } from '../../core/types';

export const storeContext = createContext<BaseStore<any> | null>(null);

export function StoreContextProvider<T>({ store: original, children }: { store: BaseStore<T>; children?: ReactNode }) {
  const copy = useMemo(() => store(original.initialValue), [original]);

  return <storeContext.Provider value={copy}>{children}</storeContext.Provider>;
}

export function useStoreContext<T>(store: BaseStore<T>) {
  const contextStore = useContext(storeContext) as BaseStore<T> | null;

  return contextStore ?? store;
}
