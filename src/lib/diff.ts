import type { KeyType } from './path';

export type Patch =
  | { op: 'add'; path: KeyType[]; value: any }
  | { op: 'remove'; path: KeyType[]; previousValue: any }
  | { op: 'replace'; path: KeyType[]; value: any; previousValue: any };

export function* diff(a: any, b: any, prefix: KeyType[] = []): Iterable<Patch> {
  if (a === b) {
    return;
  }

  if (a instanceof Map && b instanceof Map) {
    for (const [key, value] of a) {
      if (!b.has(key)) {
        yield { op: 'remove', path: [...prefix, key], previousValue: value };
      } else {
        yield* diff(value, b.get(key), [...prefix, key]);
      }
    }

    for (const [key, value] of b) {
      if (!a.has(key)) {
        yield { op: 'add', path: [...prefix, key], value: value };
      }
    }

    return;
  }

  if (a instanceof Set && b instanceof Set) {
    const aArray = [...a];
    const bArray = [...b];

    for (const value of a) {
      if (!b.has(value)) {
        const index = aArray.indexOf(value);
        yield { op: 'remove', path: [...prefix, index], previousValue: value };
      }
    }

    for (const value of b) {
      if (!a.has(value)) {
        const index = bArray.indexOf(value);
        yield { op: 'add', path: [...prefix, index], value: value };
      }
    }

    return;
  }

  if (a instanceof Object && b instanceof Object && Array.isArray(a) === Array.isArray(b)) {
    const castKey = (key: string) => (Array.isArray(a) ? Number(key) : key);

    for (const [key, value] of Object.entries(a)) {
      if (!(key in b)) {
        yield { op: 'remove', path: [...prefix, castKey(key)], previousValue: value };
      } else {
        yield* diff(value, b[key], [...prefix, castKey(key)]);
      }
    }

    for (const [key, value] of Object.entries(b)) {
      if (!(key in a)) {
        yield { op: 'add', path: [...prefix, castKey(key)], value: value };
      }
    }

    return;
  }

  yield { op: 'replace', path: prefix, value: b, previousValue: a };
}

// export function applyPatch<T>(target: T, patch: Patch): T {
//   const [first, ...rest] = patch.path;

//   if(target instanceof Map){
//     if(first )
//   }

//   // if (first !== undefined) {
//   //   return applyPatch(target[first as keyof T], { ...patch, path: rest });
//   // }
// }
