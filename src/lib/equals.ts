export const defaultEquals = (a: any, b: any) => a === b;

export const simpleShallowEquals = (a: any, b: any): boolean => {
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

    const e1 = Object.entries(a);
    const e2 = Object.entries(b);
    return e1.length === e2.length && e1.every(([key, value]) => value === b[key]);
  }

  return false;
};

export const simpleDeepEquals = (a: any, b: any): boolean => {
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

    const e1 = Object.entries(a);
    const e2 = Object.entries(b);
    return e1.length === e2.length && e1.every(([key, value]) => simpleDeepEquals(value, b[key]));
  }

  return false;
};
