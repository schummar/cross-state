import {
  createBigState,
  createDeepState,
  createItem,
  deepPathArray,
  deepPathString,
  observe,
} from './_fixtures';
import { applyPatches } from '@lib/applyPatches';
import { diff } from '@lib/diff';
import { toExtendedJsonString } from '@lib/extendedJson';
import { simpleHash } from '@lib/hash';
import { get, set } from '@lib/propAccess';
import { trackingProxy } from '@lib/trackingProxy';
import { bench, describe } from 'vite-plus/test';

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

describe('propAccess.get', () => {
  bench('shallow path, string', () => {
    observe(get(bigBase, 'meta.updatedAt'));
  });

  bench('shallow path, array', () => {
    observe(get(bigBase, ['meta', 'updatedAt']));
  });

  bench(`depth ${DEPTH} path, string`, () => {
    observe(get(deepState, deepStringPath));
  });

  bench(`depth ${DEPTH} path, array`, () => {
    observe(get(deepState, deepArrayPath));
  });
});

describe('propAccess.set', () => {
  let counter = 0;

  bench('shallow path in big state', () => {
    observe(set(bigBase, 'meta.updatedAt', counter++));
  });

  bench('path into one of 1000 items', () => {
    observe(set(bigBase, ['items', 'item-500', 'value'], counter++));
  });

  bench(`depth ${DEPTH} path`, () => {
    observe(set(deepState, deepArrayPath, counter++));
  });
});

describe('diff', () => {
  bench('single nested item, no change', () => {
    observe(diff(item, item));
  });

  bench(`big state (${BIG_SIZE} items), 2 changes`, () => {
    observe(diff(bigBase, bigChanged));
  });

  bench(`big state (${BIG_SIZE} items), 2 changes, stopAt 2`, () => {
    observe(diff(bigBase, bigChanged, { stopAt: 2 }));
  });
});

describe('applyPatches', () => {
  bench(`${bigPatches.length} patch(es) on big state`, () => {
    observe(applyPatches(bigBase, ...bigPatches));
  });
});

describe('hash', () => {
  bench('single nested item', () => {
    observe(simpleHash(item));
  });

  bench(`big state (${BIG_SIZE} items)`, () => {
    observe(simpleHash(bigBase));
  });
});

describe('serialization', () => {
  bench(`toExtendedJsonString, big state (${BIG_SIZE} items)`, () => {
    observe(toExtendedJsonString(bigBase));
  });

  bench(`JSON.stringify, big state (${BIG_SIZE} items)`, () => {
    observe(JSON.stringify(bigBase));
  });
});

describe('trackingProxy', () => {
  bench('create and read 2 properties of a nested item', () => {
    const [proxy, equals] = trackingProxy(item);
    observe(proxy.name);
    observe(proxy.meta.flags['pinned']);
    observe(equals(item));
  });

  bench(`create and read 1 property of big state (${BIG_SIZE} items)`, () => {
    const [proxy, equals] = trackingProxy(bigBase);
    observe(proxy.meta.updatedAt);
    observe(equals(bigBase));
  });

  bench(`create and read all keys of big state (${BIG_SIZE} items)`, () => {
    const [proxy, equals] = trackingProxy(bigBase);
    observe(Object.keys(proxy.items).length);
    observe(equals(bigBase));
  });
});
