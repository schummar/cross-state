import type { KeyType } from '@lib/path';

export const isAncestor = (ancestor: KeyType[], path: KeyType[]): boolean => {
  return (
    ancestor.length <= path.length &&
    ancestor.every((v, i) => v === '*' || path[i] === '*' || v === path[i])
  );
};

export const split = (
  value: any,
  path: KeyType[],
): [value: unknown, subValues: { path: KeyType[]; value: unknown }[]] => {
  const [first, ...rest] = path;
  if (first === undefined) return [value, []];

  if (rest.length === 0) {
    if (first === '*')
      return [{}, Object.entries(value).map(([k, v]) => ({ path: [k], value: v }))];
    if (!(first in value)) return [value, []];
    const { [first]: subValue, ...newValue } = value;
    return [newValue, [{ path: [first], value: subValue }]];
  }

  const newValue = { ...value };
  const subValues = new Array<{ path: KeyType[]; value: unknown }>();
  for (const key of first === '*' ? Object.keys(value) : [first]) {
    if (!(newValue[key] instanceof Object)) return [value, []];
    const result = split(newValue[key], rest);
    newValue[key] = result[0];
    subValues.push(...result[1].map((s) => ({ path: [key, ...s.path], value: s.value })));
  }
  return [newValue, subValues];
};
