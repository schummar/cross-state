export const defaultEquals = (a: any, b: any) => a === b;

export const shallowEquals = (a: any, b: any) => {
  if (a === b) return true;

  if (a instanceof Array && b instanceof Array) {
    return a.length === b.length && a.every((value, i) => value === b[i]);
  }

  if (a instanceof Object && b instanceof Object) {
    return Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, value]) => value === b[key]);
  }

  return false;
};
