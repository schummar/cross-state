export function strictEqual(a: any, b: any) {
  return a === b;
}

export function shallowEqual(a: any, b: any): boolean {
  return internalEqual(strictEqual)(a, b);
}

export function deepEqual(a: any, b: any): boolean {
  return internalEqual(deepEqual)(a, b);
}

const internalEqual = (comp: (a: any, b: any) => boolean) => (a: any, b: any) => {
  if (a === b) {
    return true;
  }

  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    // eslint-disable-next-line no-self-compare
    return a !== a && b !== b;
  }

  if (a.constructor !== b.constructor) {
    return false;
  }

  if (a.constructor === Object || Array.isArray(a)) {
    const entries1 = Object.entries(a);
    const entries2 = Object.entries(b);
    return (
      entries1.length === entries2.length && entries1.every(([key, value]) => comp(value, b[key]))
    );
  }

  if (a instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }

  if (a instanceof Map) {
    return a.size === b.size && [...a.entries()].every(([key, value]) => comp(value, b.get(key)));
  }

  if (a instanceof Set) {
    return a.size === b.size && [...a.values()].every((value) => b.has(value));
  }

  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(a)) {
    if (a.byteLength !== b.byteLength) {
      return false;
    }

    const a_ = new Int8Array(a.buffer);
    const b_ = new Int8Array(b.buffer);
    return a_.every((value, i) => value === b_[i]);
  }

  return false;
};
