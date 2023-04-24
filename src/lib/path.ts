import type {
  ArrayToStringPath,
  Array_,
  IsAny,
  IsNever,
  Object_,
  OptionalPropertyOf,
  StringToArrayPath,
  StringToNumber,
} from './typeHelpers';

export type KeyType = string | number | symbol;

export type GetKeys<T extends Object_ | Array_> = T extends Array_
  ? T extends readonly [] // special case empty tuple => no keys
    ? never
    : '0' extends keyof T // any tuple with at least one element
    ? StringToNumber<keyof T>
    : number // other array
  : keyof T;

export type _PathAsArray<T, Optional, MaxDepth, Depth extends 1[]> = 0 extends 1 & T
  ? KeyType[]
  : T extends never
  ? never
  : T extends Object_
  ? Depth extends {
      length: MaxDepth;
    }
    ? string[]
    : T extends Map<infer K extends KeyType, infer V>
    ? [K] | [K, ..._PathAsArray<V, Optional, MaxDepth, [...Depth, 1]>]
    : T extends Set<any>
    ? [number]
    : {
        [K in GetKeys<T>]:
          | (Optional extends true ? (K extends OptionalPropertyOf<T> ? [K] : never) : [K])
          | [K, ..._PathAsArray<T[K], Optional, MaxDepth, [...Depth, 1]>];
      }[GetKeys<T>]
  : never;

export type PathAsArray<
  T,
  Optional extends boolean = false,
  MaxDepth extends number = 5,
> = _PathAsArray<T, Optional, MaxDepth, []>;

export type PathAsString<
  T,
  Optional extends boolean = false,
  MaxDepth extends number = 5,
> = ArrayToStringPath<PathAsArray<T, Optional, MaxDepth>>;
export type Path<T, Optional extends boolean = false, MaxDepth extends number = 5> =
  | PathAsString<T, Optional, MaxDepth>
  | PathAsArray<T, Optional, MaxDepth>;

export type Value<T, P> = true extends IsAny<T> | IsAny<P>
  ? any
  : true extends IsNever<T> | IsNever<P>
  ? never
  : P extends string
  ? Value<T, StringToArrayPath<P>>
  : P extends [infer First extends KeyType, ...infer Rest extends KeyType[]]
  ? T extends Map<any, infer V> | Set<infer V>
    ? Value<V, Rest> | undefined
    : T extends Array_
    ? any[] extends T
      ? Value<T[First & keyof T], Rest> | undefined
      : Value<T[First & keyof T], Rest>
    : T extends Object_
    ? Record<any, any> extends T
      ? Value<T[First], Rest> | undefined
      : Value<T[First], Rest>
    : never
  : T;

export type _WildcardPathAsArray<T, MaxDepth, Depth extends 1[]> =
  | []
  | (0 extends 1 & T
      ? KeyType[]
      : T extends never
      ? never
      : T extends Object_
      ? Depth extends {
          length: MaxDepth;
        }
        ? string[]
        : T extends Map<infer K extends KeyType, infer V>
        ? ['*'] | [K] | [K, ..._WildcardPathAsArray<V, MaxDepth, [...Depth, 1]>]
        : T extends Set<any>
        ? ['*'] | [number]
        : {
            [K in GetKeys<T>]:
              | ['*']
              | [K]
              | [K, ..._WildcardPathAsArray<T[K], MaxDepth, [...Depth, 1]>];
          }[GetKeys<T>]
      : never);

export type WildcardPathAsArray<T, MaxDepth extends number = 5> = _WildcardPathAsArray<
  T,
  MaxDepth,
  []
>;
export type WildcardPathAsString<T, MaxDepth extends number = 5> = ArrayToStringPath<
  _WildcardPathAsArray<T, MaxDepth, []>
>;
export type WildcardPath<T, MaxDepth extends number = 5> =
  | WildcardPathAsString<T, MaxDepth>
  | WildcardPathAsArray<T, MaxDepth>;
