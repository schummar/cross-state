export interface EqualityOptions {
  /** Treat undefined values as absent
   * @default false
   */
  undefinedEqualsAbsent?: boolean;
}

export function strictEqual(a: any, b: any): boolean {
  return a === b;
}

export function shallowEqual(a: any, b: any, options?: EqualityOptions): boolean {
  return internalEqual(a, b, strictEqual, options);
}

export function deepEqual(a: any, b: any, options?: EqualityOptions): boolean {
  return internalEqual(a, b, (a, b) => deepEqual(a, b, options), options);
}

const internalEqual = (
  a: any,
  b: any,
  comp: (a: any, b: any) => boolean,
  { undefinedEqualsAbsent = false }: EqualityOptions = {},
) => {
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
    let entries1 = Object.entries(a);
    let entries2 = Object.entries(b);

    if (undefinedEqualsAbsent) {
      entries1 = entries1.filter(([_, value]) => value !== undefined);
      entries2 = entries2.filter(([_, value]) => value !== undefined);
    }

    return (
      entries1.length === entries2.length &&
      entries1.every(([key, value]) => key in b && comp(value, b[key]))
    );
  }

  if (a instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }

  if (a instanceof Map) {
    let entries1 = [...a.entries()];
    let entries2 = [...b.entries()];

    if (undefinedEqualsAbsent) {
      entries1 = entries1.filter(([_, value]) => value !== undefined);
      entries2 = entries2.filter(([_, value]) => value !== undefined);
    }

    return (
      entries1.length === entries2.length &&
      entries1.every(([key, value]) => b.has(key) && comp(value, b.get(key)))
    );
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
