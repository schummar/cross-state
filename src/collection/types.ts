import type { AnyCollection, Collection, CollParams } from '@collection/collection';

export type TupleToIntersection<T extends any[]> = T extends [infer First, ...infer Rest]
  ? First & TupleToIntersection<Rest>
  : unknown;

export type ExtractFromTuple<T extends any[], U> = T extends [infer First, ...infer Rest]
  ? First extends U
    ? First
    : ExtractFromTuple<Rest, U>
  : never;

export type GetParams<T extends AnyCollection> =
  T extends Collection<infer TParams> ? TParams : never;

export type GetDomain<T extends AnyCollection> = GetParams<T>['domain'];

export type GetCombinedDomain<TCollections extends AnyCollection[]> = {
  [K in keyof TCollections]: GetDomain<TCollections[K]>;
}[keyof TCollections];

export type GetItem<T extends AnyCollection> = GetParams<T>['item'];

export type GetQuery<T extends AnyCollection> = GetParams<T>['query'];

export type GetId<T extends AnyCollection> = GetParams<T>['id'];

export type GetIdType<T extends AnyCollection> = GetItem<T>[GetId<T>];

export type GetDBQuery<T extends AnyCollection> = GetParams<T>['dbQuery'];

export type GetUser<T extends AnyCollection> = GetParams<T>['user'];

export type GetCombinedUser<TCollections extends AnyCollection[]> = TupleToIntersection<{
  [K in keyof TCollections]: GetUser<TCollections[K]>;
}>;

export type GetCollectionByDomain<
  TCollections extends AnyCollection[],
  TDomain extends string,
> = ExtractFromTuple<TCollections, Collection<CollParams<TDomain, any, any, any, any, any>>>;
