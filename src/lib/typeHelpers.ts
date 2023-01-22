export type Obj = Record<string | number, unknown>;
export type Arr = readonly unknown[];

export type StringToNumber<T> = T extends `${infer K extends number}` ? K : never;

export type ArrayToStringPath<T> = T extends []
  ? ''
  : T extends [infer First extends string, ...infer Rest]
  ? First extends `${string}.${string}`
    ? never
    : Rest['length'] extends 0
    ? First
    : `${First}.${ArrayToStringPath<Rest>}`
  : never;

export type StringToArrayPath<T> = T extends '' ? [] : T extends `${infer First}.${infer Rest}` ? [First, ...StringToArrayPath<Rest>] : [T];
