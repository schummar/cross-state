import type { Arr, ArrayToStringPath, Obj, OptionalPropertyOf, StringToArrayPath, StringToNumber } from './typeHelpers';

export type KeyType = string | number;

export type GetKeys<T extends Obj | Arr> = T extends Arr
  ? T extends readonly [] // special case empty tuple => no keys
    ? never
    : '0' extends keyof T // any tuple with at least one element
    ? StringToNumber<keyof T>
    : number // other array
  : keyof T;

export type PathAsArray<T, Optional = false> = 0 extends 1 & T
  ? KeyType[]
  : T extends never
  ? never
  : T extends Obj | Arr
  ? {
      [K in GetKeys<T>]:
        | (Optional extends true ? (K extends OptionalPropertyOf<T> ? [K] : never) : [K])
        | [K, ...PathAsArray<T[K], Optional>];
    }[GetKeys<T>]
  : T extends Map<infer K extends KeyType, infer V>
  ? [K] | [K, ...PathAsArray<V, Optional>]
  : T extends Set<any>
  ? [number]
  : never;

export type PathAsString<T, Optional = false> = ArrayToStringPath<PathAsArray<T, Optional>>;
export type Path<T, Optional = false> = PathAsString<T, Optional> | PathAsArray<T, Optional>;

export type Value<T, P> = 0 extends 1 & T
  ? any
  : P extends string
  ? Value<T, StringToArrayPath<P>>
  : P extends [infer First extends KeyType, ...infer Rest extends KeyType[]]
  ? T extends Obj
    ? Record<any, any> extends T
      ? Value<T[First], Rest> | undefined
      : Value<T[First], Rest>
    : T extends Arr
    ? any[] extends T
      ? Value<T[First & keyof T], Rest> | undefined
      : Value<T[First & keyof T], Rest>
    : T extends Map<any, infer V> | Set<infer V>
    ? Value<V, Rest> | undefined
    : never
  : T;

export type WildcardPathAsArray<T> = 0 extends 1 & T
  ? KeyType[]
  : T extends never
  ? never
  : T extends Obj | Arr
  ?
      | {
          [K in GetKeys<T>]: ['*'] | [K] | [K, ...WildcardPathAsArray<T[K]>];
        }[GetKeys<T>]
  : T extends Map<infer K extends KeyType, infer V>
  ? ['*'] | [K] | [K, ...WildcardPathAsArray<V>]
  : T extends Set<any>
  ? ['*'] | [number]
  : never;

export type WildcardPathAsString<T> = ArrayToStringPath<WildcardPathAsArray<T>>;
export type WildcardPath<T> = WildcardPathAsString<T> | WildcardPathAsArray<T>;
