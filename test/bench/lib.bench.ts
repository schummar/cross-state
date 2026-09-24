import { benchGroup } from './_baseline.ts';
import {
  createBigState,
  createDeepState,
  createItem,
  deepPathArray,
  deepPathString,
  observe,
} from './_fixtures.ts';
import { applyPatches, diff, get, set, simpleHash, toExtendedJsonString } from 'cross-state';
import { test, describe } from 'vite-plus/test';

const BIG_SIZE = 1000;
const DEPTH = 20;

const bigBase = createBigState(BIG_SIZE);
const bigChanged = {
  ...bigBase,
  items: {
    ...bigBase.items,
    'item-10': { ...bigBase.items['item-10']!, value: -1 },
    'item-900': { ...bigBase.items['item-900']!, value: -1 },
  },
};

const deepState = createDeepState(DEPTH);
const deepStringPath = deepPathString(DEPTH);
const deepArrayPath = deepPathArray(DEPTH);

const item = createItem(1);
const [bigPatches] = diff(bigBase, bigChanged);

describe('propAccess', () => {
  test('get', async (ctx) => {
    await benchGroup(ctx, {
      'shallow path, string': () => observe(get(bigBase, 'meta.updatedAt')),
      'shallow path, array': () => observe(get(bigBase, ['meta', 'updatedAt'])),
      [`depth ${DEPTH} path, string`]: () => observe(get(deepState, deepStringPath)),
      [`depth ${DEPTH} path, array`]: () => observe(get(deepState, deepArrayPath)),
    });
  });

  test('set', async (ctx) => {
    let counter = 0;

    await benchGroup(ctx, {
      'shallow path in big state': () => observe(set(bigBase, 'meta.updatedAt', counter++)),
      'path into one of 1000 items': () =>
        observe(set(bigBase, ['items', 'item-500', 'value'], counter++)),
      [`depth ${DEPTH} path`]: () => observe(set(deepState, deepArrayPath, counter++)),
    });
  });
});

describe('patches', () => {
  test('diff', async (ctx) => {
    await benchGroup(ctx, {
      'single nested item, no change': () => observe(diff(item, item)),
      [`big state (${BIG_SIZE} items), 2 changes`]: () => observe(diff(bigBase, bigChanged)),
      [`big state (${BIG_SIZE} items), 2 changes, stopAt 2`]: () =>
        observe(diff(bigBase, bigChanged, { stopAt: 2 })),
    });
  });

  test('applyPatches', async (ctx) => {
    await benchGroup(ctx, {
      [`${bigPatches.length} patch(es) on big state`]: () =>
        observe(applyPatches(bigBase, ...bigPatches)),
    });
  });
});

describe('hash', () => {
  test('simpleHash', async (ctx) => {
    await benchGroup(ctx, {
      'single nested item': () => observe(simpleHash(item)),
      [`big state (${BIG_SIZE} items)`]: () => observe(simpleHash(bigBase)),
    });
  });
});

describe('serialization', () => {
  test(`big state (${BIG_SIZE} items)`, async (ctx) => {
    await benchGroup(ctx, {
      toExtendedJsonString: () => observe(toExtendedJsonString(bigBase)),
      'JSON.stringify': () => observe(JSON.stringify(bigBase)),
    });
  });
});
