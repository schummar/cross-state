import { describe, expect, test } from 'vitest';
import { hash } from './hash';

describe('hash', () => {
  test('Set', () => {
    expect(hash(new Set([1, 2, 3]))).toBe('s[1,2,3]');
  });

  test('Map', () => {
    expect(
      hash(
        new Map([
          ['a', 1],
          ['b', 2],
          ['c', 3],
        ])
      )
    ).toBe('m[["a",1],["b",2],["c",3]]');
  });

  test('Array', () => {
    expect(hash([1, 2, 3])).toBe('[1,2,3]');
  });

  test('Object', () => {
    expect(hash({ a: 1, b: 2, c: 3 })).toBe('o[["a",1],["b",2],["c",3]]');
  });

  test('Primitive', () => {
    expect(hash(0)).toBe('0');
  });

  test('Nested', () => {
    expect(hash({ a: new Set([1]), b: new Map([['a', 1]]) })).toBe('o[["a",s[1]],["b",m[["a",1]]]]');
  });
});
