export function flatClone<T>(obj: T): T {
  if (obj instanceof Map) {
    return new Map(obj) as any;
  }

  if (obj instanceof Set) {
    return new Set(obj) as any;
  }

  if (Array.isArray(obj)) {
    return [...obj] as any;
  }

  if (obj instanceof Object) {
    return { ...obj };
  }

  return obj;
}
