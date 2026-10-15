import type {
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

// Resolves to `never` when the global is not declared, e.g. without the DOM lib
type GlobalInstance<K> = K extends keyof typeof globalThis
  ? (typeof globalThis)[K] extends { prototype: infer P }
    ? P
    : never
  : never;

// Values rather than containers: paths end there instead of going into e.g. a `Date`'s methods.
// Primitives are listed for branded ones like `string & { __tag }`.
type Leaf =
  | string
  | number
  | bigint
  | boolean
  | symbol
  | Date
  | RegExp
  | ArrayBuffer
  | ArrayBufferView
  | PromiseLike<any>
  | ((...args: any) => any)
  | (abstract new (...args: any) => any)
  | GlobalInstance<
      | 'Blob'
      | 'EventTarget'
      | 'AbortController'
      | 'URL'
      | 'URLSearchParams'
      | 'FormData'
      | 'Headers'
    >;

export type GetKeys<T extends Object_ | Array_> = T extends Array_
  ? T extends readonly [] // special case empty tuple => no keys
    ? never
    : '0' extends keyof T // any tuple with at least one element
      ? StringToNumber<keyof T>
      : number // other array
  : keyof T;

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

type Segment<K> = K extends string | number ? `${K}` : never;

// An empty segment ('a..b', 'a.') never matches, not even a `string` key
type MatchKey<S, K, Form> = Form extends 'string'
  ? S extends ''
    ? false
    : S extends Segment<K>
      ? true
      : false
  : S extends K
    ? true
    : false;

type StepIntoKeys<T, S, K, Form> = K extends unknown
  ? MatchKey<S, K, Form> extends true
    ? [T[K & keyof T]]
    : never
  : never;

type PathStep<T, S, Form> = T extends Leaf
  ? never
  : T extends Map<infer K, infer V>
    ? MatchKey<S, K, Form> extends true
      ? [V]
      : never
    : T extends Set<any>
      ? MatchKey<S, number, Form> extends true
        ? [never]
        : never
      : T extends Object_
        ? StepIntoKeys<T, S, GetKeys<T>, Form>
        : never;

type OptionalLastStep<T, S, Form> = T extends Leaf
  ? never
  : T extends Map<infer K, any>
    ? MatchKey<S, K, Form> extends true
      ? [never]
      : never
    : T extends Set<any>
      ? MatchKey<S, number, Form> extends true
        ? [never]
        : never
      : T extends Object_
        ? StepIntoKeys<T, S, GetKeys<T> & OptionalPropertyOf<T>, Form>
        : never;

type SettableKeys<T extends Object_> = {
  [K in GetKeys<T>]: Partial<T> extends Omit<T, K> ? K : never;
}[GetKeys<T>];

type OptionalSettableStep<T, S, Form> = T extends Map<any, any> | Set<any> | Leaf
  ? never
  : T extends Object_
    ? StepIntoKeys<T, S, SettableKeys<T>, Form>
    : never;

type SettableStep<T, S, Form> = undefined extends T
  ? OptionalSettableStep<T, S, Form>
  : PathStep<T, S, Form>;

// Only a `string` index signature counts; an object whose keys are all optional is not a record
type IsRecord<T> = string extends keyof T ? (Record<string, any> extends T ? true : false) : false;

type WildcardStep<T, S, Form> = T extends Leaf
  ? never
  : T extends Map<infer K, infer V>
    ? (S extends '*' ? [never] : never) | (MatchKey<S, K, Form> extends true ? [V] : never)
    : T extends Set<any>
      ? S extends '*'
        ? [never]
        : MatchKey<S, number, Form> extends true
          ? [never]
          : never
      : T extends Object_
        ? IsRecord<T> extends true
          ? S extends '*'
            ? [T[string]]
            : never
          :
              | (S extends '*'
                  ? [GetKeys<T>] extends [never]
                    ? never
                    : [T[T extends Array_ ? number : keyof T]]
                  : never)
              | StepIntoKeys<T, S, GetKeys<T>, Form>
        : never;

type Step<Mode, T, S, Last, Form> = Mode extends 'settable'
  ? SettableStep<T, S, Form>
  : Mode extends 'wildcard'
    ? WildcardStep<T, S, Form>
    : Mode extends 'optional'
      ? Last extends true
        ? OptionalLastStep<T, S, Form>
        : PathStep<T, S, Form>
      : PathStep<T, S, Form>;

type StepKeys<T> = T extends Leaf
  ? never
  : T extends Map<infer K, any>
    ? K
    : T extends Set<any>
      ? number
      : T extends Object_
        ? GetKeys<T>
        : never;

type OptionalLastKeys<T> = T extends Leaf
  ? never
  : T extends Map<infer K, any>
    ? K
    : T extends Set<any>
      ? number
      : T extends Object_
        ? GetKeys<T> & OptionalPropertyOf<T>
        : never;

type OptionalSettableKeys<T> = T extends Map<any, any> | Set<any> | Leaf
  ? never
  : T extends Object_
    ? SettableKeys<T>
    : never;

type WildcardKeys<T> = T extends Leaf
  ? never
  : T extends Map<infer K, any>
    ? K | '*'
    : T extends Set<any>
      ? number | '*'
      : T extends Object_
        ? IsRecord<T> extends true
          ? '*'
          : GetKeys<T> | ([GetKeys<T>] extends [never] ? never : '*')
        : never;

// The segments that would have been valid, for the error message. They must not include the
// rejected segment, or the wrong path would be assignable to them.
type Suggest<Mode, T, Last> = Mode extends 'settable'
  ? undefined extends T
    ? OptionalSettableKeys<T>
    : StepKeys<T>
  : Mode extends 'wildcard'
    ? WildcardKeys<T>
    : Mode extends 'optional'
      ? Last extends true
        ? OptionalLastKeys<T>
        : StepKeys<T>
      : StepKeys<T>;

// Children are carried as a union of `[child]` so that one `unknown` child cannot absorb the rest
type StepEach<Mode, W, S, Last, Form> = W extends [infer C] ? Step<Mode, C, S, Last, Form> : never;
type SuggestEach<Mode, W, Last> = W extends [infer C] ? Suggest<Mode, C, Last> : never;

// Keys of `string` would match any text, including the rejected path, so they are left out
type SuggestSegment<K> = K extends string | number
  ? string extends `${K}`
    ? never
    : `${K}`
  : never;

// Keys that lead further, offered with a trailing dot where the path cannot end
type ThroughKeys<T> = T extends Leaf | Set<any>
  ? never
  : T extends Map<infer K, infer V>
    ? [StepKeys<V>] extends [never]
      ? never
      : K
    : T extends Object_
      ? { [K in GetKeys<T>]-?: [StepKeys<T[K]>] extends [never] ? never : K }[GetKeys<T>]
      : never;
type ThroughEach<W> = W extends [infer C] ? ThroughKeys<C> : never;
type AnyIn<W> = W extends [infer C] ? IsAny<C> : never;

type _ValidateString<W, P extends string, Full, Mode, Prefix extends string, Next> =
  true extends AnyIn<W>
    ? Full
    : P extends `${infer Head}.${infer Rest}`
      ? StepEach<Mode, W, Head, false, 'string'> extends infer R
        ? [R] extends [never]
          ? `${Prefix}${SuggestSegment<SuggestEach<Mode, W, false>>}`
          : _ValidateString<R, Rest, Full, Mode, `${Prefix}${Head}.`, Next>
        : never
      : StepEach<Mode, W, P, true, 'string'> extends infer R
        ? [R] extends [never]
          ? // `remove` only takes optional keys last, so also offer the keys it can go through
            | `${Prefix}${SuggestSegment<SuggestEach<Mode, W, true>>}`
            | (Mode extends 'optional' ? `${Prefix}${SuggestSegment<ThroughEach<W>>}.` : never)
          : Next extends true
            ? Full | `${Prefix}${P}.${SuggestSegment<SuggestEach<Mode, R, false>>}`
            : Full
        : never;

type _ValidateArray<W, P, Full, Mode, Prefix extends readonly unknown[]> =
  true extends AnyIn<W>
    ? Full
    : P extends readonly [infer Head, ...infer Rest]
      ? StepEach<Mode, W, Head, Rest extends readonly [] ? true : false, 'array'> extends infer R
        ? [R] extends [never]
          ? readonly [...Prefix, SuggestEach<Mode, W, Rest extends readonly [] ? true : false>]
          : Rest extends readonly []
            ? Full
            : _ValidateArray<R, Rest, Full, Mode, [...Prefix, Head]>
        : never
      : readonly [...Prefix, SuggestEach<Mode, W, false>];

type _Validate<T, P, Mode, Next> = P extends ''
  ? Mode extends 'optional'
    ? SuggestSegment<Suggest<Mode, T, true>> | `${SuggestSegment<ThroughKeys<T>>}.`
    : Next extends true
      ? P | SuggestSegment<Suggest<Mode, T, false>>
      : P
  : P extends readonly []
    ? Mode extends 'optional'
      ? readonly [Suggest<Mode, T, true>]
      : P
    : P extends string
      ? _ValidateString<[T], P, P, Mode, '', Next>
      : P extends readonly unknown[]
        ? _ValidateArray<[T], P, P, Mode, []>
        : AnyPath;

// With `Next`, a valid path also offers its next segments, which only serve completions
type _Check<T, P, Mode, Next = false> = true extends IsAny<P> ? P : _Validate<T, P, Mode, Next>;

/**
 * Evaluates to `P` if it is a path of `T`, otherwise to the segments that would be valid at the first
 * wrong one. Checking the given path instead of listing all paths of `T` keeps big types cheap, and
 * completions offer one segment at a time.
 */
// The bare `P` is what lets TypeScript infer it; the next segments are kept out of inference. Using
// `NoInfer` in the false branch too made checking generic JSX components with a path prop run out
// of memory.
// These must not be aliases of a shared alias, or passing one into another loses the inference.
export type ValidPath<T, P> = [P] extends [_Check<T, P, 'path'>]
  ? P | NoInfer<_Check<T, P, 'path', true>>
  : _Check<T, P, 'path'>;

export type ValidOptionalPath<T, P> = [P] extends [_Check<T, P, 'optional'>]
  ? P | NoInfer<_Check<T, P, 'optional', true>>
  : _Check<T, P, 'optional'>;

export type ValidSettablePath<T, P> = [P] extends [_Check<T, P, 'settable'>]
  ? P | NoInfer<_Check<T, P, 'settable', true>>
  : _Check<T, P, 'settable'>;

export type ValidWildcardPath<T, P> = [P] extends [_Check<T, P, 'wildcard'>]
  ? P | NoInfer<_Check<T, P, 'wildcard', true>>
  : _Check<T, P, 'wildcard'>;

export function isAnyPath(path: any): path is AnyPath {
  return typeof path === 'string' || Array.isArray(path);
}
