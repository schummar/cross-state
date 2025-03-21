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

export type AnyPath = string | readonly KeyType[];

export type GetKeys<T extends Object_ | Array_> = T extends Array_
  ? T extends readonly [] // special case empty tuple => no keys
    ? never
    : '0' extends keyof T // any tuple with at least one element
      ? StringToNumber<keyof T>
      : number // other array
  : keyof T;

export type _PathAsArray<T, Optional, MaxDepth, Depth extends 1[]> =
  | (Optional extends false ? readonly [] : never)
  | (true extends IsAny<T>
      ? readonly KeyType[]
      : T extends never
        ? never
        : T extends Object_
          ? Depth['length'] extends MaxDepth
            ? readonly string[]
            : T extends Map<infer K extends KeyType, infer V>
              ? readonly [K] | readonly [K, ..._PathAsArray<V, Optional, MaxDepth, [...Depth, 1]>]
              : T extends Set<any>
                ? readonly [number]
                : {
                    [K in GetKeys<T>]:
                      | (Optional extends true
                          ? K extends OptionalPropertyOf<T>
                            ? readonly [K]
                            : never
                          : readonly [K])
                      | readonly [K, ..._PathAsArray<T[K], Optional, MaxDepth, [...Depth, 1]>];
                  }[GetKeys<T>]
          : never);

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

export type Value<T, P> = P extends readonly []
  ? T
  : true extends IsAny<T> | IsAny<P>
    ? any
    : true extends IsNever<T> | IsNever<P>
      ? never
      : P extends string
        ? Value<T, StringToArrayPath<P>>
        : P extends readonly [infer First extends KeyType, ...infer Rest extends readonly KeyType[]]
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
          : never;

export type _WildcardPathAsArray<T, MaxDepth, Depth extends 1[]> =
  | []
  | (0 extends 1 & T
      ? KeyType[]
      : T extends never
        ? never
        : T extends Object_
          ? Depth['length'] extends MaxDepth
            ? string[]
            : T extends Map<infer K extends KeyType, infer V>
              ? ['*'] | [K] | [K, ..._WildcardPathAsArray<V, MaxDepth, [...Depth, 1]>]
              : T extends Set<any>
                ? ['*'] | [number]
                : Record<string, any> extends T
                  ? ['*'] | ['*', ..._WildcardPathAsArray<T[string], MaxDepth, [...Depth, 1]>]
                  : {
                      [K in GetKeys<T>]:
                        | ['*']
                        | [
                            '*',
                            ..._WildcardPathAsArray<
                              T[T extends readonly any[] ? number : keyof T],
                              MaxDepth,
                              [...Depth, 1]
                            >,
                          ]
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

export type WildcardValue<T, P> = true extends IsAny<T> | IsAny<P>
  ? any
  : true extends IsNever<T> | IsNever<P>
    ? never
    : P extends string
      ? WildcardValue<T, StringToArrayPath<P>>
      : P extends readonly [infer First extends KeyType, ...infer Rest extends KeyType[]]
        ? T extends Map<any, infer V> | Set<infer V>
          ? WildcardValue<V, Rest> | (First extends '*' ? never : undefined)
          : T extends Array_
            ? First extends '*'
              ? WildcardValue<T[number], Rest>
              : any[] extends T
                ? WildcardValue<T[First & keyof T], Rest> | undefined
                : First extends keyof T
                  ? WildcardValue<T[First], Rest>
                  : undefined
            : T extends Object_
              ? First extends '*'
                ? WildcardValue<T[keyof T], Rest>
                : Record<any, any> extends T
                  ? WildcardValue<T[First], Rest> | undefined
                  : WildcardValue<T[First], Rest>
              : never
        : T;

export type WildcardMatch<S, W> = S extends string
  ? WildcardMatch<StringToArrayPath<S>, W>
  : W extends string
    ? WildcardMatch<S, StringToArrayPath<W>>
    : [S, W] extends [readonly [], readonly []]
      ? true
      : [S, W] extends [
            readonly [infer SFirst, ...infer SRest],
            readonly [infer WFirst, ...infer WRest],
          ]
        ? [WFirst, WRest['length']] extends ['*' | SFirst, SRest['length']]
          ? WildcardMatch<SRest, WRest>
          : false
        : false;

export type Join<A extends string | number, B extends string | number> = A extends ''
  ? B
  : B extends ''
    ? A
    : `${A}.${B}`;

type _SettablePathAsArray<T, MaxDepth, Depth extends 1[]> =
  | readonly []
  | (true extends IsAny<T>
      ? readonly KeyType[]
      : undefined extends T
        ? T extends Map<any, any> | Set<any>
          ? never
          : T extends Object_
            ? {
                [K in GetKeys<T>]: Partial<T> extends Omit<T, K>
                  ?
                      | readonly [K]
                      | readonly [K, ..._SettablePathAsArray<T[K], MaxDepth, [...Depth, 1]>]
                  : readonly [];
              }[GetKeys<T>]
            : never
        : T extends never
          ? never
          : T extends Object_
            ? Depth['length'] extends MaxDepth
              ? readonly string[]
              : T extends Map<infer K extends KeyType, infer V>
                ? readonly [K] | readonly [K, ..._SettablePathAsArray<V, MaxDepth, [...Depth, 1]>]
                : T extends Set<any>
                  ? readonly [number]
                  : {
                      [K in GetKeys<T>]:
                        | readonly [K]
                        | readonly [K, ..._SettablePathAsArray<T[K], MaxDepth, [...Depth, 1]>];
                    }[GetKeys<T>]
            : never);

export type SettablePathAsArray<T, MaxDepth extends number = 5> = _SettablePathAsArray<
  T,
  MaxDepth,
  []
>;
export type SettablePathAsString<T, MaxDepth extends number = 5> = ArrayToStringPath<
  SettablePathAsArray<T, MaxDepth>
>;

export type SettablePath<T, MaxDepth extends number = 5> =
  | SettablePathAsString<T, MaxDepth>
  | SettablePathAsArray<T, MaxDepth>;

export type SettableValue<T, P> = P extends readonly []
  ? T
  : true extends IsAny<T> | IsAny<P>
    ? any
    : true extends IsNever<T> | IsNever<P>
      ? never
      : P extends string
        ? SettableValue<T, StringToArrayPath<P>>
        : P extends readonly [infer First extends KeyType, ...infer Rest extends readonly KeyType[]]
          ? T extends Map<any, infer V> | Set<infer V>
            ? SettableValue<V, Rest>
            : T extends Array_
              ? SettableValue<T[First & keyof T], Rest>
              : T extends Object_
                ? SettableValue<T[First], Rest>
                : never
          : never;
