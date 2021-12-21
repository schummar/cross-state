type FilterString<T> = T extends string ? T : never;

export declare type SelectorPaths<T> = FilterString<
  keyof {
    [K in keyof NonNullable<T> as
      | K
      | (0 extends 1 & NonNullable<T>[K]
          ? `${FilterString<K>}.${any}`
          : NonNullable<NonNullable<T>[K]> extends Record<string, unknown>
          ? `${FilterString<K>}.${SelectorPaths<NonNullable<T>[K]>}`
          : never)]: 1;
  }
>;

type Value<T, K> = K extends keyof T ? T[K] : K extends keyof NonNullable<T> ? NonNullable<T>[K] | undefined : undefined;

export type SelectorValue<T, K> = K extends `${infer K}.${infer Rest}` ? SelectorValue<Value<T, K>, Rest> : Value<T, K>;

export function createSelector<T, S>(stringSelector: string): (state: T) => S {
  const parts = stringSelector.split('.');
  return (state) => parts.reduce<any>((v, p) => (v instanceof Object && p in v ? v[p as keyof typeof v] : undefined), state);
}

export function setWithSelector(state: unknown, stringSelector: string, value: unknown): void {
  const parts = stringSelector.split('.');
  const prefix = parts.slice(0, -1);
  const last = parts[parts.length - 1]!;

  for (const part of prefix) {
    if (state instanceof Object && part in state) {
      state = state[part as keyof typeof state];
    } else {
      throw Error(`Could not set ${stringSelector} because path ${stringSelector} doesn't exist`);
    }
  }

  if (state instanceof Object) {
    state[last as keyof typeof state] = value as any;
  } else {
    throw Error(`Could not set ${stringSelector} because path ${stringSelector} doesn't exist`);
  }
}
