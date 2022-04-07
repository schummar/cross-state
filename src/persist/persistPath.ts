type FilterString<T> = T extends string ? T : never;
type Star<T> = string extends T ? '*' : number extends T ? '*' : T;

export type PersistPath<T> = FilterString<
  T extends Array<infer S>
    ? '*' | `*.${PersistPath<S>}`
    : T extends Record<any, unknown>
    ?
        | '*'
        | keyof {
            [K in FilterString<keyof T> as Star<K> | `${Star<K>}.${PersistPath<T[K]>}`]: 1;
          }
    : never
>;
