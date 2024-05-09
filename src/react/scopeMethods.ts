import type { Scope, Store } from '@core';
import {
  ScopeProvider,
  useScope,
  useScopeProp,
  useScopeStore,
  type ScopeProps,
} from '@react/scope';
import type { UseStoreOptions } from '@react/useStore';

export const scopeMethods = {
  useScope<T>(this: Scope<T>): Store<T> {
    return useScope(this);
  },

  useStore<T>(this: Scope<T>, options?: UseStoreOptions<T>): T {
    return useScopeStore(this, options);
  },

  useProp<T>(this: Scope<T>, options?: UseStoreOptions<T>): [value: T, setValue: Store<T>['set']] {
    return useScopeProp(this, options);
  },

  Provider<T>(this: Scope<T>, props: Omit<ScopeProps<T>, 'scope'>): JSX.Element {
    return ScopeProvider({ ...props, scope: this });
  },
};
