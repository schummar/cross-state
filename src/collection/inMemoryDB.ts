import type { AnyCollection } from '@collection/collection';
import { DB } from '@collection/db';
import type {
  GetCollectionByDomain,
  GetCombinedDomain,
  GetDomain,
  GetIdType,
  GetItem,
} from '@collection/types';

export class InMemoryDB<const TCollections extends AnyCollection[]> extends DB<TCollections> {
  protected data: Map<string, unknown[]> = new Map();

  constructor(initialData?: {
    [K in keyof TCollections & number as GetDomain<TCollections[K]>]?: GetItem<TCollections[K]>[];
  }) {
    super();
    if (initialData) {
      this.data = new Map(Object.entries(initialData) as [string, unknown[]][]);
    }
  }

  update<TDomain extends GetCombinedDomain<TCollections>>(
    domain: TDomain,
    item: (
      item: GetItem<GetCollectionByDomain<TCollections, TDomain>> | undefined,
    ) => GetItem<GetCollectionByDomain<TCollections, TDomain>>,
  ): void {}

  delete<TDomain extends GetCombinedDomain<TCollections>>(
    domain: TDomain,
    id: GetIdType<GetCollectionByDomain<TCollections, TDomain>>,
  ): void {}
}
