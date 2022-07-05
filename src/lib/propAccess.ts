type FilterStringOrNumber<T> = T extends string | number ? T : never;
type FilterString<T> = T extends string ? T : never;
type FilterNumber<T> = T extends number ? T : never;

type Obj = Record<string | number, unknown>;
type Arr = unknown[];

type GetKeys<T> = T extends unknown[]
  ? T extends [] // special case empty tuple => no keys
    ? never
    : '0' extends keyof T // any tuple with at least one element
    ? Exclude<keyof T, keyof []>
    : number // other array
  : keyof T; // not an array

type TupleKeys = GetKeys<[1, 2, 3]>; // "0" | "1" | "2"
type EmptyTupleKeys = GetKeys<[]>; // never
type ArrayKeys = GetKeys<string[]>; // number
type RecordKeys = GetKeys<{ x: 1; y: 2; z: 3 }>; // "x" | "y" | "z"

type GetValues<T> = T[GetKeys<T> & keyof T];

type TupleValues = GetValues<[1, 2, 3]>; // 1 | 2 | 3
type EmptyTupleValue = GetValues<[]>; // never
type ArrayValues = GetValues<string[]>; // string
type RecordValues = GetValues<{ x: 1; y: 2; z: 3 }>; // 1 | 2 | 3

export type Path<T extends Obj | Arr> = 0 extends 1 & T
  ? string
  : T extends Arr
  ? `${FilterNumber<keyof T>}`
  : FilterString<
      keyof {
        [K in FilterStringOrNumber<keyof T> as `${K}` | (T[K] extends Obj | Arr ? `${K}.${Path<T[K]>}` : never)]: 0;
      }
    >;

export type Value<T extends Obj, P extends string> = P extends `${infer K}.${infer Rest}`
  ? T[K] extends Obj
    ? Value<T[K], Rest>
    : never
  : T[P];

type A = { a: 1; b: { c: 'd' }; e: [1, 2, 3] };
type B = Path<A>;
const b: B = 'e.42';
type C = Value<A, 'e.1'>;

export function get<T extends Record<string, unknown>, P extends Path<T>>(obj: T, path: P): Value<T, P> {
  const index = path.indexOf('.');

  if (index >= 0) {
    const key = path.slice(0, index - 1);
    const rest = path.slice(index + 1);
    const subObj = obj[key];

    if (!subObj) {
      return undefined as Value<T, P>;
    }

    return get(subObj as Record<string, unknown>, rest) as Value<T, P>;
  }

  return obj[path] as Value<T, P>;
}

export function set<T extends Record<string, unknown>, P extends Path<T>>(obj: T, path: P, value: Value<T, P>): T {
  const index = path.indexOf('.');

  if (index >= 0) {
    const key = path.slice(0, index - 1);
    const rest = path.slice(index + 1);
    const subObj = obj[key];

    return {
      ...obj,
      [key]: set(subObj as Record<string, unknown>, rest, value),
    };
  }

  return {
    ...obj,
    [path]: value,
  };
}
