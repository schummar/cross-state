import { Store as BaseStore } from '../store';
import { SelectorPaths, SelectorValue } from '../helpers/stringSelector';
import { useStoreProp, UseStorePropResult } from './useStoreProp';
import { useStoreState, UseStoreStateOptions } from './useStoreState';

export class Store<T> extends BaseStore<T> {
  useState(options?: UseStoreStateOptions): T;
  useState<S>(selector: (state: T) => S, dependencies?: any[], options?: UseStoreStateOptions): S;
  useState<K extends SelectorPaths<T>>(selector: K, options?: UseStoreStateOptions): SelectorValue<T, K>;
  useState(...args: any[]): any {
    return useStoreState(this, ...args);
  }

  useProp<K extends SelectorPaths<T>>(selector: K): UseStorePropResult<T, K> {
    return useStoreProp(this, selector);
  }
}
