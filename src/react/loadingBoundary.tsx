import { createStore } from '@core';
import { useStore } from '@react/useStore';
import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';

export interface LoadingBoundaryEntry {
  label?: ReactNode;
}

export interface LoadingBoundaryProps {
  /**
   * Fallback node to render when there are loading components within the boundary.
   */
  fallback?: ReactNode | ((entries: LoadingBoundaryEntry[]) => ReactNode);

  /**
   * Child node to render when there are no loading components within the boundary.
   */
  children?: ReactNode;

  /**
   * Add a loading state from outside the boundary. Useful for when you want to
   * show a loading state for a component that is not a child of the boundary.
   */
  isLoading?: boolean;
}

const LoadingBoundaryContext = createContext(createStore(new Set<LoadingBoundaryEntry>()));

export function LoadingBoundary({
  fallback,
  children,
  isLoading: isLoadingExternal,
}: LoadingBoundaryProps) {
  const store = useMemo(() => createStore(new Set<LoadingBoundaryEntry>()), []);
  const entries = useStore(store);
  const isLoading = entries.size > 0 || isLoadingExternal;

  const fallbackNode = isLoading
    ? typeof fallback === 'function'
      ? fallback([...entries])
      : fallback
    : undefined;

  return (
    <LoadingBoundaryContext.Provider value={store}>
      {fallbackNode !== undefined ? (
        <>
          {fallbackNode}
          <div style={{ display: 'none' }}>{children}</div>
        </>
      ) : (
        children
      )}
    </LoadingBoundaryContext.Provider>
  );
}

export function useLoadingBoundary(isLoading: boolean | undefined, label?: ReactNode) {
  const store = useContext(LoadingBoundaryContext);

  useLayoutEffect(() => {
    if (!isLoading) {
      return;
    }

    const entry = { label };
    store.set((entries) => new Set(entries).add(entry));

    return () => {
      store.set((entries) => {
        const newEntries = new Set(entries);
        newEntries.delete(entry);
        return newEntries;
      });
    };
  }, [isLoading]);
}
