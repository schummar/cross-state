import type { Collection } from '@collection/collection';
import { DB } from '@collection/db';
import type { GetCollectionByDomain, GetIdType, GetParam, GetParamUnion } from '@collection/types';

export class InMemoryDB<const TCollections extends Collection[]> extends DB<TCollections> {
  protected data: Map<string, Map<string, unknown>> = new Map();

  constructor(initialData?: {
    [K in keyof TCollections & number as GetParam<TCollections[K], 'domain'>]?: GetParam<
      TCollections[K],
      'item'
    >[];
  }) {
    super();
    if (initialData) {
      for (const [domain, items] of Object.entries(initialData)) {
        const map = new Map<string, unknown>();

        for (const item of items as unknown[]) {
          const id = items.set(String(id), item);
        }
      }
    }
  }

  update<TDomain extends GetParamUnion<TCollections, 'domain'>>(
    domain: TDomain,
    item: (
      item: GetParam<GetCollectionByDomain<TCollections, TDomain>, 'item'> | undefined,
    ) => GetParam<GetCollectionByDomain<TCollections, TDomain>, 'item'>,
  ): void {
    return {} as any;
  }

  delete<TDomain extends GetParamUnion<TCollections, 'domain'>>(
    domain: TDomain,
    id: GetIdType<GetCollectionByDomain<TCollections, TDomain>>,
  ): void {}
}
