import React, { Context, createContext, ReactNode, useContext, useMemo } from 'react';
import { SelectorPaths, SelectorValue } from '../helpers/stringSelector';
import { Store } from './store';
import { useStoreProp, UseStorePropResult } from './useStoreProp';
import { useStoreState, UseStoreStateOptions } from './useStoreState';

export class StoreScope<T> {
  readonly context: Context<Store<T>>;

  constructor(public readonly defaultValue: T) {
    this.context = createContext(new Store(defaultValue));
  }

  Provider = ({ children, store }: { children: ReactNode; store?: Store<T> }): JSX.Element => {
    const _store = useMemo(() => store ?? new Store(this.defaultValue), [store]);

    return <this.context.Provider value={_store}>{children}</this.context.Provider>;
  };

  withScope = <Args extends Record<string, unknown>>(Component: (args: Args) => JSX.Element) => {
    return (args: Args): JSX.Element => (
      <this.Provider>
        <Component {...args} />
      </this.Provider>
    );
  };

  useStore(): Store<T> {
    return useContext(this.context);
  }

  useState(options?: { throttle?: number }): T;
  useState<S>(selector: (state: T) => S, dependencies?: any[], options?: { throttle?: number }): S;
  useState<K extends SelectorPaths<T>>(selector: K, options?: UseStoreStateOptions): SelectorValue<T, K>;
  useState(...args: any[]): any {
    const store = this.useStore();
    return useStoreState(store, ...args);
  }

  useProp<K extends SelectorPaths<T>>(selector: K): UseStorePropResult<T, K> {
    const store = this.useStore();
    return useStoreProp(store, selector);
  }
}
