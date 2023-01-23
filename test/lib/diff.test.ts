import { describe, expect, test } from 'vitest';
import { diff } from '../../src/lib/diff';

describe('diff', () => {
  test('object', () => {
    const a = { x: 1, y: 2 };
    const b = { x: 1, y: 3 };
    const result = diff(a, b);

    expect(result).toEqual([[{ op: 'replace', path: ['y'], value: 3 }], [{ op: 'replace', path: ['y'], value: 2 }]]);
  });

  test('array', () => {
    const a = [1, 2];
    const b = [1, 3];
    const result = diff(a, b);

    expect(result).toEqual([[{ op: 'replace', path: [1], value: 3 }], [{ op: 'replace', path: [1], value: 2 }]]);
  });

  test('map', () => {
    const a = new Map([
      ['x', 1],
      ['y', 2],
    ]);
    const b = new Map([
      ['x', 1],
      ['y', 3],
    ]);
    const result = diff(a, b);

    expect(result).toEqual([[{ op: 'replace', path: ['y'], value: 3 }], [{ op: 'replace', path: ['y'], value: 2 }]]);
  });

  test('set', () => {
    const a = new Set([1, 2]);
    const b = new Set([1, 3]);
    const result = diff(a, b);

    expect(result).toEqual([[{ op: 'replace', path: [1], value: 3 }], [{ op: 'replace', path: [1], value: 2 }]]);
  });

  test('nested', () => {
    const a = { x: 1, y: { z: 2 } };
    const b = { x: 1, y: { z: 3 } };
    const result = diff(a, b);

    expect(result).toEqual([[{ op: 'replace', path: ['y', 'z'], value: 3 }], [{ op: 'replace', path: ['y', 'z'], value: 2 }]]);
  });

  test('nested map', () => {
    const a = new Map<string, unknown>([
      ['x', 1],
      ['y', new Map([['z', 2]])],
    ]);
    const b = new Map<string, unknown>([
      ['x', 1],
      ['y', new Map([['z', 3]])],
    ]);
    const result = diff(a, b);

    expect(result).toEqual([[{ op: 'replace', path: ['y', 'z'], value: 3 }], [{ op: 'replace', path: ['y', 'z'], value: 2 }]]);
  });

  test('set nested in map', () => {
    const a = new Map<string, unknown>([['x', new Set([1])]]);
    const b = new Map<string, unknown>([['x', new Set([2])]]);
    const result = diff(a, b);

    expect(result).toEqual([[{ op: 'replace', path: ['x', 0], value: 2 }], [{ op: 'replace', path: ['x', 0], value: 1 }]]);
  });
});
