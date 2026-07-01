import type { KeyOfType } from '@collection/types';
import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';

export interface Collection<
  TDomain extends string = any,
  TItem extends object = any,
  TQuery = any,
  TId extends keyof TItem = any,
  TTime extends KeyOfType<TItem, Date> = any,
  TUser = any,
> {
  domain: TDomain;
  collectionName?: string;
  schema: StandardSchemaV1<any, TItem>;
  query: StandardJSONSchemaV1<any, TQuery>;
  id: TId;
  time: TTime;
  matches(item: TItem, query: TQuery): boolean;
  auth?: (query: TQuery, user: TUser) => TQuery;
}

export function createCollection<
  TDomain extends string,
  TItem extends object,
  TQuery,
  TId extends keyof TItem,
  TTime extends KeyOfType<TItem, number | bigint | Date>,
  TUser,
>(
  collection: Collection<TDomain, TItem, TQuery, TId, TTime, TUser>,
): Collection<TDomain, TItem, TQuery, TId, TTime, TUser> {
  return collection;
}
