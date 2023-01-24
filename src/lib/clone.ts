export function flatClone<T>(object: T): T {
  if (object instanceof Map) {
    return new Map(object) as any;
  }

  if (object instanceof Set) {
    return new Set(object) as any;
  }

  if (Array.isArray(object)) {
    return [...object] as any;
  }

  if (object instanceof Object) {
    return { ...object };
  }

  return object;
}
