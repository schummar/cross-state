import { createBigState, createDeepState, createItem, createSmallState } from './_fixtures';
import { deepEqual, shallowEqual, strictEqual } from '@lib/equals';
import { bench, describe } from 'vite-plus/test';

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

describe('equals: flat object (3 keys)', () => {
  bench('strictEqual', () => {
    strictEqual(smallA, smallB);
  });

  bench('shallowEqual', () => {
    shallowEqual(smallA, smallB);
  });

  bench('deepEqual, equal', () => {
    deepEqual(smallA, smallB);
  });

  bench('deepEqual, different', () => {
    deepEqual(smallA, smallDifferent);
  });
});

describe('equals: nested object (single item)', () => {
  bench('deepEqual, equal', () => {
    deepEqual(itemA, itemB);
  });

  bench('deepEqual, different deep in the tree', () => {
    deepEqual(itemA, itemDifferentDeep);
  });
});

describe('equals: big state (1000 items)', () => {
  bench('deepEqual, same reference', () => {
    deepEqual(bigA, bigA);
  });

  bench('deepEqual, equal by value (worst case)', () => {
    deepEqual(bigA, bigB);
  });

  bench('deepEqual, differs in first compared key', () => {
    deepEqual(bigA, bigDifferentFirst);
  });

  bench('deepEqual, differs in last item', () => {
    deepEqual(bigA, bigDifferentLast);
  });

  bench('shallowEqual, equal by value', () => {
    shallowEqual(bigA, bigB);
  });
});

describe('equals: array of 10000 numbers', () => {
  bench('deepEqual, equal', () => {
    deepEqual(numbersA, numbersB);
  });

  bench('deepEqual, differs in last element', () => {
    deepEqual(numbersA, numbersDifferentLast);
  });

  bench('shallowEqual, equal', () => {
    shallowEqual(numbersA, numbersB);
  });
});

describe('equals: deeply nested (depth 50)', () => {
  bench('deepEqual, equal', () => {
    deepEqual(deepA, deepB);
  });
});

describe('equals: collections', () => {
  bench('deepEqual, Map with 500 nested entries', () => {
    deepEqual(mapA, mapB);
  });

  bench('deepEqual, Set with 5000 strings', () => {
    deepEqual(setA, setB);
  });
});

describe('equals: undefinedEqualsAbsent option', () => {
  bench('deepEqual, big state, default', () => {
    deepEqual(bigA, bigB);
  });

  bench('deepEqual, big state, undefinedEqualsAbsent', () => {
    deepEqual(bigA, bigB, { undefinedEqualsAbsent: true });
  });
});
