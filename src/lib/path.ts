import type { Arr, ArrayToStringPath, Obj, StringToArrayPath, StringToNumber } from './typeHelpers';

export type KeyType = string | number;

export type GetKeys<T extends Obj | Arr> = T extends Arr
  ? T extends readonly [] // special case empty tuple => no keys
    ? never
    : '0' extends keyof T // any tuple with at least one element
    ? StringToNumber<keyof T>
    : number // other array
  : keyof T;

export type PathAsArray<T> = 0 extends 1 & T
  ? string[]
  : T extends never
  ? never
  : T extends Obj | Arr
  ? {
      [K in GetKeys<T>]: [K] | [K, ...PathAsArray<T[K]>];
    }[GetKeys<T>]
  : T extends Map<infer K, infer V>
  ? [K] | [K, ...PathAsArray<V>]
  : T extends Set<unknown>
  ? [number]
  : never;

export type PathAsString<T> = ArrayToStringPath<PathAsArray<T>>;

export type Path<T> = PathAsString<T> | PathAsArray<T>;

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
    : T extends Map<unknown, infer V> | Set<infer V>
    ? Value<V, Rest> | undefined
    : never
  : T;
