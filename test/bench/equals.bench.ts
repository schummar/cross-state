import { benchGroup } from './_baseline.ts';
import { createBigState, createDeepState, createItem, createSmallState } from './_fixtures.ts';
import { deepEqual, shallowEqual, strictEqual } from 'cross-state';
import { test, describe } from 'vite-plus/test';

const smallA = createSmallState(1);
const smallB = createSmallState(1);
const smallDifferent = { ...smallA, count: 2 };

const itemA = createItem(1);
const itemB = createItem(1);
const itemDifferentDeep = {
  ...itemA,
  meta: { ...itemA.meta, flags: { ...itemA.meta.flags, pinned: !itemA.meta.flags.pinned } },
};

const bigA = createBigState(1000);
const bigB = createBigState(1000);
const bigDifferentFirst = { ...bigA, version: 1 };
const bigDifferentLast = {
  ...bigA,
  items: { ...bigA.items, 'item-999': { ...bigA.items['item-999']!, value: -1 } },
};

const numbersA = Array.from({ length: 10_000 }, (_, index) => index);
const numbersB = [...numbersA];
const numbersDifferentLast = [...numbersA.slice(0, -1), -1];

const deepA = createDeepState(50);
const deepB = createDeepState(50);

const mapA = new Map(
  Array.from({ length: 500 }, (_, index) => [`key-${index}`, createItem(index)]),
);
const mapB = new Map(
  Array.from({ length: 500 }, (_, index) => [`key-${index}`, createItem(index)]),
);

const setA = new Set(Array.from({ length: 5_000 }, (_, index) => `value-${index}`));
const setB = new Set(Array.from({ length: 5_000 }, (_, index) => `value-${index}`));

const bytesA = Uint8Array.from({ length: 10_000 }, (_, index) => index % 256);
const bytesB = Uint8Array.from(bytesA);

describe('equals', () => {
  test('flat object (3 keys)', async (ctx) => {
    await benchGroup(ctx, {
      strictEqual: () => strictEqual(smallA, smallB),
      shallowEqual: () => shallowEqual(smallA, smallB),
      'deepEqual, equal': () => deepEqual(smallA, smallB),
      'deepEqual, different': () => deepEqual(smallA, smallDifferent),
    });
  });

  test('nested object (single item)', async (ctx) => {
    await benchGroup(ctx, {
      'deepEqual, equal': () => deepEqual(itemA, itemB),
      'deepEqual, different deep in the tree': () => deepEqual(itemA, itemDifferentDeep),
    });
  });

  test('big state (1000 items)', async (ctx) => {
    await benchGroup(ctx, {
      'deepEqual, same reference': () => deepEqual(bigA, bigA),
      'deepEqual, equal by value (worst case)': () => deepEqual(bigA, bigB),
      'deepEqual, differs in first compared key': () => deepEqual(bigA, bigDifferentFirst),
      'deepEqual, differs in last item': () => deepEqual(bigA, bigDifferentLast),
      'shallowEqual, equal by value': () => shallowEqual(bigA, bigB),
    });
  });

  test('array of 10000 numbers', async (ctx) => {
    await benchGroup(ctx, {
      'deepEqual, equal': () => deepEqual(numbersA, numbersB),
      'deepEqual, differs in last element': () => deepEqual(numbersA, numbersDifferentLast),
      'shallowEqual, equal': () => shallowEqual(numbersA, numbersB),
    });
  });

  test('deeply nested (depth 50)', async (ctx) => {
    await benchGroup(ctx, {
      'deepEqual, equal': () => deepEqual(deepA, deepB),
    });
  });

  test('collections', async (ctx) => {
    await benchGroup(ctx, {
      'deepEqual, Map with 500 nested entries': () => deepEqual(mapA, mapB),
      'deepEqual, Set with 5000 strings': () => deepEqual(setA, setB),
    });
  });

  test('typed arrays', async (ctx) => {
    await benchGroup(ctx, {
      'deepEqual, Uint8Array with 10000 bytes': () => deepEqual(bytesA, bytesB),
    });
  });

  test('undefinedEqualsAbsent option', async (ctx) => {
    await benchGroup(ctx, {
      'deepEqual, big state, default': () => deepEqual(bigA, bigB),
      'deepEqual, big state, undefinedEqualsAbsent': () =>
        deepEqual(bigA, bigB, { undefinedEqualsAbsent: true }),
    });
  });
});
