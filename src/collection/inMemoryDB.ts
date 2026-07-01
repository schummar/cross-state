import type { Collection } from '@collection/collection';
import { getTime, matchesTime } from '@collection/helpers';
import { ServerCollection } from '@collection/server';
import type { GetParam } from '@collection/types';
import { simpleHash } from '@lib/hash';

export interface InMemoryServerCollectionOptions<TCollection extends Collection> {
  collection: TCollection;
  initialData?: readonly GetParam<TCollection, 'item'>[];
}

export class InMemoryServerCollection<
  const TCollection extends Collection,
> extends ServerCollection<TCollection> {
  protected data: Map<string, GetParam<TCollection, 'item'>> = new Map();

  constructor(public readonly options: InMemoryServerCollectionOptions<TCollection>) {
    super(options);

    if (options.initialData) {
      for (const item of options.initialData) {
        const id = item[this.options.collection.id];
        const key = simpleHash(id);
        this.data.set(key, item);
      }
    }
  }

  list(
    include: GetParam<TCollection, 'query'>[],
    exclude: GetParam<TCollection, 'query'>[],
    t: number | null,
  ): GetParam<TCollection, 'item'>[] {
    const results: GetParam<TCollection, 'item'>[] = [];

    for (const item of this.data.values()) {
      if (
        matchesTime(this.options.collection, item, t) &&
        include.every((query) => this.options.collection.matches(item, query)) &&
        exclude.every((query) => !this.options.collection.matches(item, query))
      ) {
        results.push(item);
      }
    }

    return results.sort((a, b) => {
      const timeA = getTime(this.options.collection, a);
      const timeB = getTime(this.options.collection, b);

      return timeA - timeB;
    });
  }

  update(item: GetParam<TCollection, 'item'>): GetParam<TCollection, 'item'> {
    const id = item[this.options.collection.id];
    const key = simpleHash(id);

    item = {
      ...item,
      [this.options.collection.time]: new Date(),
    };

    this.data.set(key, item);
    return item;
  }

  delete(id: GetParam<TCollection, 'id'>): number {
    const key = simpleHash(id);
    this.data.delete(key);
    return Date.now();
  }
}
