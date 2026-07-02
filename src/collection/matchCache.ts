import type { Collection } from '@collection/collection';
import type { GetParam } from '@collection/types';

export default class MatchCache<TCollection extends Collection> {
  private cache: Map<string, boolean> = new Map();

  constructor(private readonly collection: TCollection) {}

  matches(
    item: GetParam<TCollection, 'item'>,
    queryKey: string,
    query: GetParam<TCollection, 'query'>,
  ): boolean {
    let matches = this.cache.get(queryKey);

    if (matches === undefined) {
      matches = this.collection.matches(item, query);
      this.cache.set(queryKey, matches);
    }

    return matches;
  }
}
