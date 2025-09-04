import { deepEqual, shallowEqual, strictEqual } from '@index';
import { describe, expect, test } from 'vitest';

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
});
