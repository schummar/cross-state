import { describe, expect, test } from 'vitest';
import { hash, simpleHash } from '../../src/lib/hash';

describe('hash', () => {
  test('Set', () => {
    expect(simpleHash(new Set([1, 2, 3]))).toBe('s[1,2,3]');
  });

  test('Map', () => {
    expect(
      simpleHash(
        new Map([
          ['a', 1],
          ['b', 2],
          ['c', 3],
        ]),
      ),
    ).toBe('m[["a",1],["b",2],["c",3]]');
  });

  test('Array', () => {
    expect(simpleHash([1, 2, 3])).toBe('[1,2,3]');
  });

  test('Object', () => {
    expect(simpleHash({ a: 1, b: 2, c: 3 })).toBe('o[["a",1],["b",2],["c",3]]');
  });

  test('Primitive', () => {
    expect(simpleHash(0)).toBe('0');
  });

  test('Nested', () => {
    expect(simpleHash({ a: new Set([1]), b: new Map([['a', 1]]) })).toBe(
      'o[["a",s[1]],["b",m[["a",1]]]]',
    );
  });

  test('with dates', () => {
    expect(simpleHash(new Date(0))).toBe('"1970-01-01T00:00:00.000Z"');
    expect(simpleHash(new Date(0))).not.toBe(simpleHash(new Date(1)));
  });

  test('custom hash function', () => {
    const value = {
      [hash](): string {
        return 'custom';
      },
    };

    expect(simpleHash(value)).toBe('custom');
  });
});
