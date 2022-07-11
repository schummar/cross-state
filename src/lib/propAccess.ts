type FilterKey<T> = T extends string | number ? T : never;
type FilterString<T> = T extends string ? T : never;

type Obj = Record<string | number, unknown>;
type Arr = readonly unknown[];

type GetKeys<T> = T extends readonly unknown[]
  ? T extends readonly [] // special case empty tuple => no keys
    ? never
    : '0' extends keyof T // any tuple with at least one element
    ? Exclude<keyof T, keyof []>
    : number // other array
  : keyof T; // not an array

export type Path<T extends Obj | Arr> = 0 extends 1 & T
  ? string
  : T extends never
  ? never
  : FilterString<
      keyof {
        [K in FilterKey<GetKeys<T>> as `${K}` | (T[K] extends Obj | Arr | undefined | null ? `${K}.${Path<NonNullable<T[K]>>}` : never)]: 0;
      }
    >;

export type Value<T extends Obj | Arr, P extends string> = P extends `${infer K}.${infer Rest}`
  ? T[K & keyof T] extends Obj | Arr
    ? Value<T[K & keyof T], Rest>
    : T[K & keyof T] extends Obj | Arr | undefined | null
    ? Value<NonNullable<T[K & keyof T]>, Rest> | undefined
    : never
  : T[P & keyof T];

export function get<T extends Obj | Arr, P extends Path<T>>(obj: T, path: P): Value<T, P> {
  const index = path.indexOf('.');

  if (index >= 0) {
    const key = path.slice(0, index);
    const rest = path.slice(index + 1);
    const subObj = obj[key as any];

    if (!subObj) {
      return undefined as any;
    }

    return get(subObj as Record<string, unknown>, rest) as Value<T, P>;
  }

  return obj[path as any] as Value<T, P>;
}

export function set<T extends Obj | Arr, P extends Path<T>>(obj: T, path: P, value: Value<T, P>, rootPath = path): T {
  const index = path.indexOf('.');
  let key, update;

  if (index >= 0) {
    key = path.slice(0, index);
    const rest = path.slice(index + 1);
    const subObj = obj[key as any];

    if (!subObj) {
      const prefix = rootPath.slice(0, -rest.length - 1);
      throw Error(`Cannot set ${rootPath} because ${prefix} is ${subObj}`);
    }

    update = set(subObj as Record<string, unknown>, rest, value, rootPath);
  } else {
    key = path;
    update = value;
  }

  if (Array.isArray(obj)) {
    const copy = Array.from(obj);
    copy[key as any] = update;
    return copy as any;
  }

  return {
    ...obj,
    [key]: update,
  };
}
