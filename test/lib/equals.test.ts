import { deepEqual, shallowEqual, strictEqual } from '@index';
import { describe, expect, test } from 'vite-plus/test';

describe('strictEqual', () => {
  test('should return true if a and b are strictly equal', () => {
    const a = {};
    const b = a;
    expect(strictEqual(a, b)).toBe(true);
  });

  test('should return false if a and b are not strictly equal', () => {
    const a = {};
    const b = {};
    expect(strictEqual(a, b)).toBe(false);
  });
});

describe('shallowEqual', () => {
  test('should return true if a and b are strictly equal', () => {
    const a = {};
    const b = a;
    expect(shallowEqual(a, b)).toBe(true);
  });

  test('should return true if a and b are shallowly equal arrays', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(shallowEqual(a, b)).toBe(true);
  });

  test('should return true if a and b are shallowly equal objects', () => {
    const a = { a: 1, b: 2 };
    const b = { a: 1, b: 2 };
    expect(shallowEqual(a, b)).toBe(true);
  });

  test('should return false if a and b are not shallowly equal', () => {
    const a = [[1]];
    const b = [[1]];
    expect(shallowEqual(a, b)).toBe(false);
  });
});

describe('deepEqual', () => {
  test('should return true if a and b are deeply equal arrays', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(deepEqual(a, b)).toBe(true);
  });

  test('should return true if a and b are deeply equal objects', () => {
    const a = { a: 1, b: 2 };
    const b = { a: 1, b: 2 };
    expect(deepEqual(a, b)).toBe(true);
  });

  test('should return true if a and b are deeply equal dates', () => {
    const a = new Date(0);
    const b = new Date(0);
    expect(deepEqual(a, b)).toBe(true);
  });

  test('should return true if a and b are deeply equal regexps', () => {
    const a = /a/g;
    const b = /a/g;
    expect(deepEqual(a, b)).toBe(true);
  });

  test('should return true if a and b are deeply equal maps', () => {
    const a = new Map([[1, 2]]);
    const b = new Map([[1, 2]]);
    expect(deepEqual(a, b)).toBe(true);
  });

  test('should return true if a and b are deeply equal sets', () => {
    const a = new Set([1, 2]);
    const b = new Set([1, 2]);
    expect(deepEqual(a, b)).toBe(true);
  });

  test('should return true if a and b are deeply equal buffers', () => {
    const a = new Int8Array([1, 2, 3]);
    const b = new Int8Array([1, 2, 3]);
    expect(deepEqual(a, b)).toBe(true);
  });

  test('should return false if a and b are not deeply equal', () => {
    const a = { a: { b: { c: 1 } } };
    const b = { a: { b: { c: 2 } } };
    expect(deepEqual(a, b)).toBe(false);
  });

  test('should return false if a and b are not deeply equal because of undefined object values', () => {
    const a = { a: undefined };
    const b = { b: undefined };
    expect(deepEqual(a, b)).toBe(false);
  });

  test('should return false if a and b are not deeply equal because of undefined map values', () => {
    const a = new Map([[1, undefined]]);
    const b = new Map([[2, undefined]]);
    expect(deepEqual(a, b)).toBe(false);
  });

  test('should return true if a and b are deeply equal except for undefined object values', () => {
    const a = { a: undefined };
    const b = { b: undefined };
    expect(deepEqual(a, b, { undefinedEqualsAbsent: true })).toBe(true);
  });

  test('should return true if a and b are deeply equal except for undefined object values nested', () => {
    const a = { c: { a: undefined } };
    const b = { c: { b: undefined } };
    expect(deepEqual(a, b, { undefinedEqualsAbsent: true })).toBe(true);
  });

  test('should return true if a and b are deeply equal except for undefined map values', () => {
    const a = new Map([[1, undefined]]);
    const b = new Map([[2, undefined]]);
    expect(deepEqual(a, b, { undefinedEqualsAbsent: true })).toBe(true);
  });

  test('should treat NaN as equal to NaN', () => {
    expect(deepEqual(Number.NaN, Number.NaN)).toBe(true);
    expect(deepEqual({ a: Number.NaN }, { a: Number.NaN })).toBe(true);
    expect(shallowEqual({ a: Number.NaN }, { a: Number.NaN })).toBe(false);
  });

  test('should return false for arrays of different length or content', () => {
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
    expect(deepEqual([[1], [2]], [[1], [3]])).toBe(false);
    expect(deepEqual([[1], [2]], [[1], [2]])).toBe(true);
  });

  test('should return false for objects with different keys', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    expect(deepEqual({ a: undefined }, {})).toBe(false);
    expect(deepEqual({}, { a: undefined })).toBe(false);
  });

  test('should return false for different types', () => {
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual({}, null)).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual(new Map(), new Set())).toBe(false);
    expect(deepEqual(1, '1')).toBe(false);
  });

  test('should compare maps and sets by content', () => {
    expect(deepEqual(new Map([[1, { a: 1 }]]), new Map([[1, { a: 1 }]]))).toBe(true);
    expect(deepEqual(new Map([[1, { a: 1 }]]), new Map([[1, { a: 2 }]]))).toBe(false);
    expect(
      deepEqual(
        new Map([[1, 1]]),
        new Map([
          [1, 1],
          [2, 2],
        ]),
      ),
    ).toBe(false);
    expect(deepEqual(new Set([1, 2]), new Set([1, 3]))).toBe(false);
    expect(deepEqual(new Set([1, 2]), new Set([1, 2, 3]))).toBe(false);
  });

  test('should compare typed arrays by content', () => {
    expect(deepEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(deepEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false);
  });

  test('should compare typed array views by their own range', () => {
    const buffer = new Uint8Array([1, 2, 3, 1, 2, 9]);
    expect(deepEqual(buffer.subarray(0, 2), buffer.subarray(3, 5))).toBe(true);
    expect(deepEqual(buffer.subarray(0, 3), buffer.subarray(3, 6))).toBe(false);
    expect(deepEqual(buffer.subarray(0, 2), new Uint8Array([1, 2]))).toBe(true);
  });

  test('should ignore undefined values on both sides with undefinedEqualsAbsent', () => {
    const options = { undefinedEqualsAbsent: true };
    expect(deepEqual({ a: 1, b: undefined }, { a: 1 }, options)).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined }, options)).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 }, options)).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: undefined }, options)).toBe(false);
    expect(
      deepEqual(
        new Map([[1, 1]]),
        new Map([
          [1, 1],
          [2, 2],
        ]),
        options,
      ),
    ).toBe(false);
  });
});
