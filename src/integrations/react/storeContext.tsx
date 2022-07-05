import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import type { Store } from '../../core/types';

export const storeContext = createContext(new Map<Store<any>, Store<any>>());

export function StoreContextProvider({ store, children }: { store: Store<any>; children?: ReactNode }) {
  const instance = useMemo(() => store.clone(), [store]);
  const context = useContext(storeContext);

  const updatedContext = useMemo(() => {
    const updatedContext = new Map(context);
    updatedContext.set(store, instance);
    return updatedContext;
  }, [instance, context]);

  return <storeContext.Provider value={updatedContext}>{children}</storeContext.Provider>;
}

export function useStoreContext<S extends Store<any>>(store: S) {
  const context = useContext(storeContext);
  const instance = context.get(store) as S | undefined;

  return instance ?? store;
}
