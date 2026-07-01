import type { Collection } from '@collection/collection';
import type { GetParam } from '@collection/types';

export function matchesTime<TCollection extends Collection>(
  collection: TCollection,
  item: GetParam<TCollection, 'item'>,
  t: number | null,
): boolean {
  if (t === null) {
    return true;
  }

  return getTime(collection, item) >= t;
}

export function getTime<TCollection extends Collection>(
  collection: TCollection,
  item: GetParam<TCollection, 'item'>,
): number {
  const itemTime: number | Date = item[collection.time];
  if (typeof itemTime === 'number') {
    return itemTime;
  }

  return itemTime.getTime();
}
