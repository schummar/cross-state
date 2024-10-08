import { type KeyType } from './path';

export type Object_ = Record<string | number | symbol, any>;
export type Array_ = readonly any[];

export type StringToNumber<T> = T extends `${infer K extends number}` ? K : never;

export type ArrayToStringPath<T> = T extends readonly []
  ? ''
  : T extends readonly [infer First extends string | number, ...infer Rest]
    ? First extends `${string}.${string}`
      ? never
      : Rest extends readonly []
        ? `${First}`
        : `${First}.${ArrayToStringPath<Rest>}`
    : T extends readonly KeyType[]
      ? string
      : never;

export type StringToArrayPath<T> = T extends ''
  ? readonly []
  : T extends `${infer First}.${infer Rest}`
    ? readonly [First, ...StringToArrayPath<Rest>]
    : readonly [T];

export type OptionalPropertyOf<T> = Exclude<
  {
    [K in keyof T]: string extends K
      ? K
      : number extends K
        ? K
        : symbol extends K
          ? K
          : T extends Record<K, T[K]>
            ? never
            : K;
  }[keyof T],
  undefined
>;

export type OptionalProperties<T> = Pick<T, OptionalPropertyOf<T>>;

export type IsAny<T> = 0 extends 1 & T ? true : false;

export type IsNever<T> = [T] extends [never] ? true : false;
