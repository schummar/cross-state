export type Path = (string | number)[];

export const isAncestor = (ancestor: Path, path: Path): boolean => {
  return ancestor.length <= path.length && ancestor.every((v, i) => v === '*' || path[i] === '*' || String(v) === String(path[i]));
};

export const get = (value: unknown, path: Path): unknown => {
  for (const part of path) {
    if (value instanceof Object && part in value) value = value[part as keyof typeof value];
    else {
      value = undefined;
      break;
    }
  }
  return value;
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const split = (value: any, path: Path): [value: unknown, subValues: { path: Path; value: unknown }[]] => {
  const [first, ...rest] = path;
  if (first === undefined) return [value, []];

  if (rest.length === 0) {
    if (first === '*') return [{}, Object.entries(value).map(([k, v]) => ({ path: [k], value: v }))];
    if (!(first in value)) return [value, []];
    const { [first]: subValue, ...newValue } = value;
    return [newValue, [{ path: [first], value: subValue }]];
  }

  const newValue = { ...value };
  const subValues = new Array<{ path: Path; value: unknown }>();
  for (const key of first === '*' ? Object.keys(value) : [first]) {
    if (!(newValue[key] instanceof Object)) return [value, []];
    const result = split(newValue[key], rest);
    newValue[key] = result[0];
    subValues.push(...result[1].map((s) => ({ path: [key, ...s.path], value: s.value })));
  }
  return [newValue, subValues];
};
