import type { Collection } from '@collection/collection';
import { getTime, matchesTime } from '@collection/helpers';
import {
  ServerCollection,
  type ServerCollectionOptions,
  type ServerDeleteResult,
  type ServerUpdateResult,
} from '@collection/server';
import type { GetParam } from '@collection/types';
import { simpleHash } from '@lib/hash';
import type { MaybePromise } from '@lib/maybePromise';

export interface InMemoryServerCollectionOptions<
  TCollection extends Collection,
> extends ServerCollectionOptions<TCollection> {
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
  ): MaybePromise<
    Iterable<GetParam<TCollection, 'item'>> | AsyncIterable<GetParam<TCollection, 'item'>>
  > {
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

  update(item: GetParam<TCollection, 'item'>): ServerUpdateResult<TCollection> {
    const id = item[this.options.collection.id];
    const key = simpleHash(id);
    const oldItem = this.data.get(key) ?? null;

    item = {
      ...item,
      [this.options.collection.time]: new Date(),
    };

    this.data.set(key, item);
    return { oldItem, newItem: item };
  }

  delete(id: GetParam<TCollection, 'id'>): ServerDeleteResult<TCollection> | null {
    const key = simpleHash(id);
    const item = this.data.get(key);

    if (!item) {
      return null;
    }

    this.data.delete(key);

    return {
      item,
      t: Date.now(),
    };
  }
}
