import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import type { Store } from '../../core/commonTypes';

export const storeScopeContext = createContext(new Map<Store<any>, Store<any>>());

export function StoreScope({ store, children }: { store: Store<any>; children?: ReactNode }) {
  const instance = useMemo(() => store.recreate(), [store]);
  const context = useContext(storeScopeContext);

  const updatedContext = useMemo(() => {
    const updatedContext = new Map(context);
    updatedContext.set(store, instance);
    return updatedContext;
  }, [instance, context]);

  return <storeScopeContext.Provider value={updatedContext}>{children}</storeScopeContext.Provider>;
}

export function useStoreScope<S extends Store<any>>(store: S) {
  const context = useContext(storeScopeContext);
  const instance = context.get(store) as S | undefined;

  return instance ?? store;
}
