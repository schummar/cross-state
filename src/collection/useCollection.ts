import type { CollectionClient } from '@collection/client';
import type { AnyCollection } from '@collection/collection';
import type { GetIdType, GetItem, GetQuery } from '@collection/types';
import { useSyncExternalStore } from 'react';

export interface UseCollectionOptions<TCollection extends AnyCollection> {
  query: GetQuery<TCollection>;
}

export function useCollection<TCollection extends AnyCollection>(
  client: CollectionClient<TCollection>,
  useOptions: UseCollectionOptions<TCollection>,
): GetItem<TCollection>[] {
  const set = client.getSet(useOptions.query);

  return useSyncExternalStore(
    (callback) => set.subscribe(callback),
    () => set.get(),
    () => set.get(),
  );
}

export function useCollectionItem<TCollection extends AnyCollection>(
  client: CollectionClient<TCollection>,
  id: GetIdType<TCollection>,
): GetItem<TCollection> | null {
  return null;
}
