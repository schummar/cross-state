import type { KeyType } from './path';

export type Patch =
  | { op: 'add'; path: KeyType[]; value: any }
  | { op: 'remove'; path: KeyType[] }
  | { op: 'replace'; path: KeyType[]; value: any };

export function diff(a: any, b: any): [patches: Patch[], reversePatches: Patch[]] {
  const result = [..._diff(a, b)];
  const patches = result.map(([patch]) => patch);
  const reversePatches = result.map(([, reversePatch]) => reversePatch);

  return [patches, reversePatches];
}

function* _diff(a: any, b: any, prefix: KeyType[] = []): Iterable<[patch: Patch, reversePatch: Patch]> {
  if (a === b) {
    return;
  }

  if (a instanceof Map && b instanceof Map) {
    for (const [key, value] of a) {
      if (!b.has(key)) {
        yield [
          { op: 'remove', path: [...prefix, key] },
          { op: 'add', path: [...prefix, key], value: value },
        ];
      } else {
        yield* _diff(value, b.get(key), [...prefix, key]);
      }
    }

    for (const [key, value] of b) {
      if (!a.has(key)) {
        yield [
          { op: 'add', path: [...prefix, key], value: value },
          { op: 'remove', path: [...prefix, key] },
        ];
      }
    }

    return;
  }

  if (a instanceof Set && b instanceof Set) {
    // const aArray = [...a];
    // const bArray = [...b];

    // for (const value of a) {
    //   if (!b.has(value)) {
    //     const index = aArray.indexOf(value);
    //     yield [
    //       { op: 'remove', path: [...prefix, index] },
    //       { op: 'add', path: [...prefix, index], value: value },
    //     ];
    //   }
    // }

    // for (const value of b) {
    //   if (!a.has(value)) {
    //     const index = bArray.indexOf(value);
    //     yield [
    //       { op: 'add', path: [...prefix, index], value: value },
    //       { op: 'remove', path: [...prefix, index] },
    //     ];
    //   }
    // }

    // return;

    a = [...a];
    b = [...b];
  }

  if (a instanceof Object && b instanceof Object && Array.isArray(a) === Array.isArray(b)) {
    const castKey = (key: string) => (Array.isArray(a) ? Number(key) : key);

    for (const [key, value] of Object.entries(a)) {
      if (!(key in b)) {
        yield [
          { op: 'remove', path: [...prefix, castKey(key)] },
          { op: 'add', path: [...prefix, castKey(key)], value: value },
        ];
      } else {
        yield* _diff(value, b[key], [...prefix, castKey(key)]);
      }
    }

    for (const [key, value] of Object.entries(b)) {
      if (!(key in a)) {
        yield [
          { op: 'add', path: [...prefix, castKey(key)], value: value },
          { op: 'remove', path: [...prefix, castKey(key)] },
        ];
      }
    }

    return;
  }

  yield [
    { op: 'replace', path: prefix, value: b },
    { op: 'replace', path: prefix, value: a },
  ];
}
