import { type KeyType } from './path';

export type Object_ = Record<string | number | symbol, any>;
export type Array_ = readonly any[];

export type StringToNumber<T> = T extends `${infer K extends number}` ? K : never;

export type ArrayToStringPath<T> = T extends []
  ? ''
  : T extends [infer First extends string | number, ...infer Rest]
  ? First extends `${string}.${string}`
    ? never
    : Rest extends []
    ? `${First}`
    : `${First}.${ArrayToStringPath<Rest>}`
  : T extends KeyType[]
  ? string
  : never;

export type StringToArrayPath<T> = T extends ''
  ? []
  : T extends `${infer First}.${infer Rest}`
  ? [First, ...StringToArrayPath<Rest>]
  : [T];

export type OptionalPropertyOf<T> = Exclude<
  {
    [K in keyof T]: T extends Record<K, T[K]> ? never : K;
  }[keyof T],
  undefined
>;

export type IsAny<T> = 0 extends 1 & T ? true : false;

export type IsNever<T> = [T] extends [never] ? true : false;
