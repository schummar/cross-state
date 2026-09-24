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
  return internalEqual(a, b, false, options?.undefinedEqualsAbsent ?? false);
}

export function deepEqual(a: any, b: any, options?: EqualityOptions): boolean {
  return internalEqual(a, b, true, options?.undefinedEqualsAbsent ?? false);
}

function compare(a: any, b: any, deep: boolean, undefinedEqualsAbsent: boolean): boolean {
  return deep ? internalEqual(a, b, true, undefinedEqualsAbsent) : a === b;
}

function internalEqual(a: any, b: any, deep: boolean, undefinedEqualsAbsent: boolean): boolean {
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

  if (Array.isArray(a) && !undefinedEqualsAbsent) {
    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (!compare(a[i], b[i], deep, undefinedEqualsAbsent)) {
        return false;
      }
    }

    return true;
  }

  if (a.constructor === Object || Array.isArray(a)) {
    const keys = Object.keys(a);
    let count = 0;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      const value = a[key];

      if (undefinedEqualsAbsent && value === undefined) {
        continue;
      }

      count++;
      const other = b[key];

      if (
        (other === undefined && !(key in b)) ||
        !compare(value, other, deep, undefinedEqualsAbsent)
      ) {
        return false;
      }
    }

    return count === countKeys(b, undefinedEqualsAbsent);
  }

  if (a instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }

  if (a instanceof Map) {
    let count = 0;

    for (const [key, value] of a) {
      if (undefinedEqualsAbsent && value === undefined) {
        continue;
      }

      count++;

      if (!b.has(key) || !compare(value, b.get(key), deep, undefinedEqualsAbsent)) {
        return false;
      }
    }

    if (!undefinedEqualsAbsent) {
      return count === b.size;
    }

    for (const value of b.values()) {
      if (value !== undefined) {
        count--;
      }
    }

    return count === 0;
  }

  if (a instanceof Set) {
    if (a.size !== b.size) {
      return false;
    }

    for (const value of a) {
      if (!b.has(value)) {
        return false;
      }
    }

    return true;
  }

  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(a)) {
    if (a.byteLength !== b.byteLength) {
      return false;
    }

    const a_ = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    const b_ = new Uint8Array(
      (b as ArrayBufferView).buffer,
      (b as ArrayBufferView).byteOffset,
      b.byteLength,
    );

    for (let i = 0; i < a_.length; i++) {
      if (a_[i] !== b_[i]) {
        return false;
      }
    }

    return true;
  }

  return false;
}

function countKeys(object: any, undefinedEqualsAbsent: boolean): number {
  if (!undefinedEqualsAbsent) {
    return Object.keys(object).length;
  }

  let count = 0;

  for (const key of Object.keys(object)) {
    if (object[key] !== undefined) {
      count++;
    }
  }

  return count;
}
