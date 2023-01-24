import { useStore } from './useStore';
import type { FetchStore } from '@core/fetchStore';
import type { SubscribeOptions } from '@core/commonTypes';

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
