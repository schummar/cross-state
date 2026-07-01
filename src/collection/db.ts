import type { Collection } from '@collection/collection';
import type { GetParam } from '@collection/types';

export type DBEvent =
  | ['update', value: unknown, previousValue: unknown]
  | ['delete', value: unknown, previousValue: unknown]
  | ['clear'];

export abstract class DB<const TCollection extends Collection> {
  abstract list(query: GetParam<TCollection, 'query'>): Promise<GetParam<TCollection, 'item'>[]>;
}
