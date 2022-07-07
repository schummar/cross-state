import type { AtomicStore } from '../../core/atomicStore';
import type { UpdateFn } from '../../core/types';
import type { Path, Value } from '../../lib/propAccess';
import { get, set } from '../../lib/propAccess';
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
  ...[arg0, arg1]: [options?: UseStoreOptions] | [selector: string, options?: UseStoreOptions]
): [any, UpdateFn<any>] {
  store = useStoreScope(store);

  const selector = typeof arg0 === 'string' ? (obj: any) => get(obj, arg0) : (obj: any) => obj;
  const setter = typeof arg0 === 'string' ? (obj: any, value: any) => set(obj, arg0, value) : () => value;
  const options = typeof arg0 === 'string' ? arg1 : arg0;

  const value = useStore(store, selector, options);

  function setValue(value: any) {
    store.set((obj: any) => setter(obj, value));
  }

  return [value, setValue];
}
