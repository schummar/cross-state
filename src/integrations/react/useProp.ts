import type { AtomicStore } from '../../core/atomicStore';
import type { UpdateFn } from '../../core/types';
import { makeSelector } from '../../lib/makeSelector';
import type { Path, Value } from '../../lib/propAccess';
import { set } from '../../lib/propAccess';
import { useStoreScope } from './storeScope';
import type { UseStoreOptions } from './useStore';
import { useStore } from './useStore';

export function useProp<T>(store: AtomicStore<T>, options?: UseStoreOptions): [value: T, setValue: UpdateFn<T>];
export function useProp<T extends Record<string, unknown>, P extends Path<T>>(
  store: AtomicStore<T>,
  selector: P,
  options?: UseStoreOptions
): [value: Value<T, P>, setValue: UpdateFn<Value<T, P>>];
export function useProp(
  store: AtomicStore<unknown>,
  ...[arg1, arg2]: [options?: UseStoreOptions] | [selector: string, options?: UseStoreOptions]
): [any, UpdateFn<any>] {
  store = useStoreScope(store);

  const selector = makeSelector(typeof arg1 === 'string' ? arg1 : undefined);
  const setter = typeof arg1 === 'string' ? (obj: any, value: any) => set(obj, arg1, value) : () => value;
  const options = typeof arg1 === 'string' ? arg2 : arg1;

  const value = useStore(store, selector, options);

  function setValue(value: any) {
    store.update((obj: any) => setter(obj, value));
  }

  return [value, setValue];
}
