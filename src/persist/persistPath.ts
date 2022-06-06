type FilterString<T> = T extends string ? T : never;

export type PersistPath<T> = FilterString<
  T extends Record<any, unknown>
    ?
        | '*'
        | keyof {
            [K in FilterString<keyof T> as K | `${K}.${PersistPath<T[K]>}`]: 1;
          }
    : never
>;
