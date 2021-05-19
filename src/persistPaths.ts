type FilterString<T> = T extends string ? T : never;
type Star<T> = string extends T ? '*' : number extends T ? '*' : T;

export type PersistPaths<T> = FilterString<
  T extends Array<infer S>
    ? '*' | `*.${PersistPaths<S>}`
    : T extends Record<any, unknown>
    ?
        | '*'
        | keyof {
            [K in FilterString<keyof T> as Star<K> | `${Star<K>}.${PersistPaths<T[K]>}`]: 1;
          }
    : never
>;
