export function defaultEquals(a: any, b: any) {
  return a === b;
}

export function simpleShallowEquals(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, i) => value === b[i]);
  }

  if (typeof a === 'object' && typeof b === 'object') {
    if (a === null || b === null) {
      return false;
    }

    const entries1 = Object.entries(a);
    const entries2 = Object.entries(b);
    return (
      entries1.length === entries2.length && entries1.every(([key, value]) => value === b[key])
    );
  }

  return false;
}

export function simpleDeepEquals(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, i) => simpleDeepEquals(value, b[i]));
  }

  if (typeof a === 'object' && typeof b === 'object') {
    if (a === null || b === null) {
      return false;
    }

    const entries1 = Object.entries(a);
    const entries2 = Object.entries(b);
    return (
      entries1.length === entries2.length &&
      entries1.every(([key, value]) => simpleDeepEquals(value, b[key]))
    );
  }

  return false;
}
