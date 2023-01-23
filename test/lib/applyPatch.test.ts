import { describe, expect, test } from 'vitest';
import { applyPatches } from '../../src/lib/applyPatches';
import { diff } from '../../src/lib/diff';

describe('applyPatch', () => {
  test('object', () => {
    expect(applyPatches({ x: 1 }, { op: 'add', path: ['y'], value: 2 })).toEqual({ x: 1, y: 2 });
    expect(applyPatches({ x: 1 }, { op: 'remove', path: ['x'] })).toEqual({});
    expect(applyPatches({ x: 1 }, { op: 'replace', path: ['x'], value: 2 })).toEqual({ x: 2 });
  });

  test('array', () => {
    expect(applyPatches([1], { op: 'add', path: [1], value: 2 })).toEqual([1, 2]);
    expect(applyPatches([1], { op: 'remove', path: [0] })).toEqual([,]);
    expect(applyPatches([1], { op: 'replace', path: [0], value: 2 })).toEqual([2]);
  });

  test('map', () => {
    expect(applyPatches(new Map([['x', 1]]), { op: 'add', path: ['y'], value: 2 })).toEqual(
      new Map([
        ['x', 1],
        ['y', 2],
      ])
    );
    expect(applyPatches(new Map([['x', 1]]), { op: 'remove', path: ['x'] })).toEqual(new Map());
    expect(applyPatches(new Map([['x', 1]]), { op: 'replace', path: ['x'], value: 2 })).toEqual(new Map([['x', 2]]));
  });

  test('set', () => {
    expect(applyPatches(new Set([1]), { op: 'add', path: [1], value: 2 })).toEqual(new Set([1, 2]));
    expect(applyPatches(new Set([1]), { op: 'remove', path: [0] })).toEqual(new Set());
    expect(applyPatches(new Set([1]), { op: 'replace', path: [0], value: 2 })).toEqual(new Set([2]));
  });

  test('nested', () => {
    expect(applyPatches({ x: 1, y: { z: 2 } }, { op: 'replace', path: ['y', 'z'], value: 3 })).toEqual({
      x: 1,
      y: { z: 3 },
    });
  });

  test('multiple patches', () => {
    expect(applyPatches({ x: 1 }, { op: 'add', path: ['y'], value: 2 }, { op: 'replace', path: ['x'], value: 3 })).toEqual({ x: 3, y: 2 });
  });

  test('patches and inverse patches cancel each other out', () => {
    const a = {
      a: 1,
      b: { c: 3 },
      d: [1, 2, 3],
      e: new Set([1, 2, 3]),
      f: new Map([
        ['a', 1],
        ['b', 2],
      ]),
    };
    const b = {
      a: 1,
      b: { c: 4 },
      d: [1, 4, 3],
      e: new Set([1, 4, 3]),
      f: new Map([
        ['a', 4],
        ['c', 2],
      ]),
    };

    const [patches, reversePatches] = diff(a, b);

    expect(applyPatches(a, ...patches)).toEqual(b);
    expect(applyPatches(a, ...patches, ...reversePatches)).toEqual(a);
  });
});
