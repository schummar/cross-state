import { SelectorPaths, SelectorValue, setWithSelector } from '../helpers/stringSelector';
import { Store } from './store';
import { useStoreState } from './useStoreState';

export type UseStorePropResult<T, K extends SelectorPaths<T>> = {
  value: SelectorValue<T, K>;
  update: (value: SelectorValue<T, K>) => void;
};

export function useStoreProp<T, K extends SelectorPaths<T>>(store: Store<T>, selector: K): UseStorePropResult<T, K> {
  const value = useStoreState(store, selector);
  const update = (value: SelectorValue<T, K>) => store.update((state) => setWithSelector(state, selector, value));

  return { value, update };
}
