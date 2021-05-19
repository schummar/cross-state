export function flatMap<T, S>(arr: T[], fn: (t: T) => S[]): S[] {
  const result = new Array<S>();
  for (const t of arr) result.push(...fn(t));
  return result;
}
