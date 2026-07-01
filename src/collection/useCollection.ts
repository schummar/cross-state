import type { ClientCollection } from '@collection/client';
import type { Collection } from '@collection/collection';
import type { GetIdType, GetParam } from '@collection/types';
import { useSyncExternalStore } from 'react';

export interface UseCollectionOptions<TCollection extends Collection> {
  query: GetParam<TCollection, 'query'>;
}

export function useCollection<TCollection extends Collection>(
  client: ClientCollection<TCollection>,
  useOptions: UseCollectionOptions<TCollection>,
): GetParam<TCollection, 'item'>[] {
  const set = client.getSet(useOptions.query);

  return useSyncExternalStore(
    (callback) => set.subscribe(callback),
    () => set.get(),
    () => set.get(),
  );
}

export function useCollectionItem<TCollection extends Collection>(
  client: ClientCollection<TCollection>,
  id: GetIdType<TCollection>,
): GetParam<TCollection, 'item'> | null {
  return null;
}
