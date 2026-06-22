import type { StandardJSONSchemaV1, StandardSchemaV1 } from '@standard-schema/spec';

export interface CollParams<
  TDomain extends string = any,
  TItem extends object = any,
  TQuery = any,
  TId extends keyof TItem = any,
  TDBQuery = any,
  TUser = any,
> {
  domain: TDomain;
  item: TItem;
  query: TQuery;
  id: TId;
  dbQuery: TDBQuery;
  user: TUser;
}

export interface CollectionOptions<
  TDomain extends string,
  TItem extends object,
  TQuery,
  TId extends keyof TItem,
  TDBQuery,
  TUser,
> {
  domain: TDomain;
  dbName?: string;
  schema: StandardSchemaV1<unknown, TItem>;
  query: StandardJSONSchemaV1<unknown, TQuery>;
  id: TId;
  matches(item: TItem, query: TQuery): boolean;
  createDBQuery?(query: TQuery): TDBQuery;
  auth?: (query: TQuery, user: TUser) => TQuery;
}

export type AnyCollection = Collection<any>;

export class Collection<TParams extends CollParams = any> {
  constructor(
    public readonly options: CollectionOptions<
      TParams['domain'],
      TParams['item'],
      TParams['query'],
      TParams['id'],
      TParams['dbQuery'],
      TParams['user']
    >,
  ) {}
}

export function createCollection<
  TDomain extends string,
  TItem extends object,
  TQuery,
  TId extends keyof TItem,
  TDBQuery,
  TUser,
>(
  options: CollectionOptions<TDomain, TItem, TQuery, TId, TDBQuery, TUser>,
): Collection<CollParams<TDomain, TItem, TQuery, TId, TDBQuery, TUser>> {
  return new Collection(options);
}
