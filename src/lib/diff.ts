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

function* _diff(
  a: any,
  b: any,
  prefix: KeyType[] = [],
): Iterable<[patch: Patch, reversePatch: Patch]> {
  if (a === b) {
    return;
  }

  if (a instanceof Map && b instanceof Map) {
    return yield* mapDiff(a, b, prefix);
  }

  if (a instanceof Set && b instanceof Set) {
    a = [...a];
    b = [...b];
  }

  if (a instanceof Object && b instanceof Object && Array.isArray(a) === Array.isArray(b)) {
    return yield* objectDiff(a, b, prefix);
  }

  yield [
    { op: 'replace', path: prefix, value: b },
    { op: 'replace', path: prefix, value: a },
  ];
}

function* mapDiff(
  a: Map<any, any>,
  b: Map<any, any>,
  prefix: KeyType[],
): Iterable<[patch: Patch, reversePatch: Patch]> {
  for (const [key, value] of a) {
    if (!b.has(key)) {
      yield [
        { op: 'remove', path: [...prefix, key] },
        { op: 'add', path: [...prefix, key], value },
      ];
    } else {
      yield* _diff(value, b.get(key), [...prefix, key]);
    }
  }

  for (const [key, value] of b) {
    if (!a.has(key)) {
      yield [
        { op: 'add', path: [...prefix, key], value },
        { op: 'remove', path: [...prefix, key] },
      ];
    }
  }
}

function* objectDiff(
  a: any,
  b: any,
  prefix: KeyType[],
): Iterable<[patch: Patch, reversePatch: Patch]> {
  const castKey = (key: string) => (Array.isArray(a) ? Number(key) : key);

  for (const [key, value] of Object.entries(a)) {
    if (!(key in b)) {
      yield [
        { op: 'remove', path: [...prefix, castKey(key)] },
        { op: 'add', path: [...prefix, castKey(key)], value },
      ];
    } else {
      yield* _diff(value, b[key], [...prefix, castKey(key)]);
    }
  }

  for (const [key, value] of Object.entries(b)) {
    if (!(key in a)) {
      yield [
        { op: 'add', path: [...prefix, castKey(key)], value },
        { op: 'remove', path: [...prefix, castKey(key)] },
      ];
    }
  }
}
