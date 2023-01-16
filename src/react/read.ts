import type { FetchStore } from '..';
import type { SubscribeOptions } from '../core/commonTypes';
import { useStore } from './useStore';

export type UseStoreOptions = Omit<SubscribeOptions, 'runNow'>;

export function read<T>(store: FetchStore<T>, options?: UseStoreOptions): T {
  const { status, value, error } = useStore(store, options);

  if (status === 'value') {
    return value;
  }

  if (status === 'error') {
    throw error;
  }

  throw store.fetch();
}
