type FilterString<T> = T extends string ? T : never;
type FilterCharacters<T> = T extends `${any}${'.' | '*'}${any}` ? never : T extends string ? T : never;

export type PersistPath<T> = FilterString<
  T extends Record<any, unknown>
    ?
        | '*'
        | keyof {
            [K in FilterCharacters<keyof T> as K | `${K}.${PersistPath<T[K]>}`]: 1;
          }
    : never
>;
