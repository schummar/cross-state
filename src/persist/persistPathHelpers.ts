import type { KeyType } from '@lib/path';

export const isAncestor = (ancestor: KeyType[], path: KeyType[]): boolean => {
  return (
    ancestor.length <= path.length &&
    ancestor.every((v, i) => v === '*' || path[i] === '*' || v === path[i])
  );
};

export const split = (value: any, path: KeyType[]): { path: KeyType[]; value: unknown }[] => {
  const [first, ...rest] = path;
  if (first === undefined) return [{ path: [], value }];

  let entries: Map<KeyType, unknown>;
  if (value instanceof Map) {
    entries = value;
  } else if (value instanceof Set) {
    entries = new Map([...value].map((v, i) => [i, v]));
  } else if (Array.isArray(value)) {
    entries = new Map(value.map((v, i) => [i, v]));
  } else if (typeof value === 'object' && value !== null) {
    entries = new Map(Object.entries(value));
  } else {
    return [{ path: [], value }];
  }

  if (first === '*') {
    return [...entries].flatMap(([k, v]) =>
      split(v, rest).map(({ path, value }) => ({ path: [k, ...path], value })),
    );
  }

  const subValue = entries.get(first);
  if (subValue === undefined) return [{ path: [], value }];

  return split(subValue, rest).map(({ path, value }) => ({ path: [first, ...path], value }));
};
