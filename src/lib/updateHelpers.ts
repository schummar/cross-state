export function findOrDefault<T>(
  array: T[],
  predicate: (item: T) => boolean,
  defaultValue: T | (() => T),
): T {
  const index = array.findIndex(predicate);

  if (index >= 0) {
    return array[index]!;
  }

  const value = defaultValue instanceof Function ? defaultValue() : defaultValue;
  array.push(value);
  return value;
}
