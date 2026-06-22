import { type Collection } from '@collection/collection';
import type { ExtractFromTuple } from '@lib/typeHelpers';

export type GetParams<T extends Collection> =
  T extends Collection<
    infer TDomain,
    infer TItem,
    infer TQuery,
    infer TId,
    infer TTime,
    infer TDBQuery,
    infer TUser
  >
    ? {
        domain: TDomain;
        item: TItem;
        query: TQuery;
        id: TId;
        time: TTime;
        dbQuery: TDBQuery;
        user: TUser;
      }
    : never;

type ParamKey = keyof GetParams<any>;

export type GetParam<
  TCollection extends Collection,
  TParam extends ParamKey,
> = GetParams<TCollection>[TParam];

export type GetParamUnion<
  TCollections extends Collection[],
  TParam extends ParamKey,
> = TCollections extends [infer First extends Collection, ...infer Rest extends Collection[]]
  ? GetParam<First, TParam> | GetParamUnion<Rest, TParam>
  : never;

export type GetParamIntersection<
  TCollections extends Collection[],
  TParam extends ParamKey,
> = TCollections extends [infer First extends Collection, ...infer Rest extends Collection[]]
  ? GetParam<First, TParam> & GetParamIntersection<Rest, TParam>
  : unknown;

export type GetIdType<TCollection extends Collection> = GetParam<TCollection, 'item'>[GetParam<
  TCollection,
  'id'
>];

export type GetCollectionByDomain<
  TCollections extends Collection[],
  TDomain extends string,
> = ExtractFromTuple<TCollections, { domain: TDomain }>;

export type KeyOfType<TObject, TType> = keyof {
  [K in keyof TObject as TObject[K] extends TType ? K : never]: any;
};
