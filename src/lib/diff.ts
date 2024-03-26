import { isObject } from '@lib/helpers';
import { deepEqual } from './equals';
import type { KeyType } from './path';

export type Patch =
  | { op: 'add'; path: KeyType[]; value: any }
  | { op: 'remove'; path: KeyType[] }
  | { op: 'replace'; path: KeyType[]; value: any };

export interface DiffOptions {
  stopAt?: number | ((path: KeyType[]) => boolean);
}

export function diff(
  a: any,
  b: any,
  options: DiffOptions = {},
): [patches: Patch[], reversePatches: Patch[]] {
  const result = [..._diff(a, b, options)];
  const patches = result.map(([patch]) => patch);
  const reversePatches = result.map(([, reversePatch]) => reversePatch);

  return [patches, reversePatches];
}

function* _diff(
  a: any,
  b: any,
  options: DiffOptions,
  prefix: KeyType[] = [],
): Iterable<[patch: Patch, reversePatch: Patch]> {
  if (a === b) {
    return;
  }

  if (
    (typeof options.stopAt === 'number' && prefix.length >= options.stopAt) ||
    (typeof options.stopAt === 'function' && options.stopAt(prefix))
  ) {
    if (deepEqual(a, b)) {
      return;
    }

    return yield [
      { op: 'replace', path: prefix, value: b },
      { op: 'replace', path: prefix, value: a },
    ];
  }

  if (a instanceof Map && b instanceof Map) {
    return yield* mapDiff(a, b, options, prefix);
  }

  if (a instanceof Set && b instanceof Set) {
    a = [...a];
    b = [...b];
  }

  if (isObject(a) && isObject(b) && Array.isArray(a) === Array.isArray(b)) {
    return yield* objectDiff(a, b, options, prefix);
  }

  yield [
    { op: 'replace', path: prefix, value: b },
    { op: 'replace', path: prefix, value: a },
  ];
}

function* mapDiff(
  a: Map<any, any>,
  b: Map<any, any>,
  options: { stopAt?: number | ((path: KeyType[]) => boolean) },
  prefix: KeyType[],
): Iterable<[patch: Patch, reversePatch: Patch]> {
  for (const [key, value] of a) {
    if (!b.has(key)) {
      yield [
        { op: 'remove', path: [...prefix, key] },
        { op: 'add', path: [...prefix, key], value },
      ];
    } else {
      yield* _diff(value, b.get(key), options, [...prefix, key]);
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
  options: { stopAt?: number | ((path: KeyType[]) => boolean) },
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
      yield* _diff(value, b[key], options, [...prefix, castKey(key)]);
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
