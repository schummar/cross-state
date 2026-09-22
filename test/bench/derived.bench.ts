import { createBigState, createSmallState, cycler, observe, type BenchItem } from './_fixtures';
import { createStore, type Store } from '@core/store';
import { bench, describe } from 'vite-plus/test';

const VARIANTS = 64;
const BIG_SIZE = 1000;

const bigBase = createBigState(BIG_SIZE);

/** Only `version` changes, so every derived value stays equal — the work is all comparison. */
const bigShallowChanges = Array.from({ length: VARIANTS }, (_, index) => ({
  ...bigBase,
  version: index + 1,
}));

function makeSources(count: number): Store<number>[] {
  return Array.from({ length: count }, (_, index) => createStore(index));
}

describe('store.map: propagate a source change', () => {
  const byPath = createStore(createSmallState());
  const mappedByPath = byPath.map('count');
  mappedByPath.subscribe(observe, { runNow: false });

  const bySelector = createStore(createSmallState());
  const mappedBySelector = bySelector.map((state) => state.count);
  mappedBySelector.subscribe(observe, { runNow: false });

  const chained = createStore({ a: { b: { c: { d: { e: 0 } } } } });
  const chainedMapped = chained
    .map((state) => state.a)
    .map((state) => state.b)
    .map((state) => state.c)
    .map((state) => state.d)
    .map((state) => state.e);
  chainedMapped.subscribe(observe, { runNow: false });

  let counter = 0;

  bench('map by path, 1 subscriber', () => {
    byPath.set('count', counter++);
  });

  bench('map by selector, 1 subscriber', () => {
    bySelector.set('count', counter++);
  });

  bench('chain of 5 maps, 1 subscriber', () => {
    chained.set(['a', 'b', 'c', 'd', 'e'], counter++);
  });
});

describe('store.map: many subscribers on the mapped store', () => {
  for (const count of [1, 10, 100]) {
    const source = createStore(createSmallState());
    const mapped = source.map((state) => state.count);

    for (let index = 0; index < count; index++) {
      mapped.subscribe(observe, { runNow: false });
    }

    let counter = 0;

    bench(`${count} subscriber(s)`, () => {
      source.set('count', counter++);
    });
  }
});

describe(`store.map: selector over big state (${BIG_SIZE} items)`, () => {
  const source = createStore(bigBase);
  const selectedItem: Store<BenchItem | undefined> = source.map((state) => state.items['item-500']);
  selectedItem.subscribe(observe, { runNow: false });
  const nextUnrelated = cycler(bigShallowChanges);

  const selectedCount = source.map((state) => state.order.length);
  selectedCount.subscribe(observe, { runNow: false });

  bench('select one item, unrelated change', () => {
    source.set(nextUnrelated());
  });

  bench('read selected item (cached)', () => {
    observe(selectedItem.get());
  });

  bench('read derived scalar (cached)', () => {
    observe(selectedCount.get());
  });
});

describe('computed store: get() while up to date', () => {
  for (const count of [1, 5, 20]) {
    const sources = makeSources(count);
    const computed = createStore(({ use }) => sources.reduce((sum, s) => sum + use(s), 0));
    computed.get();

    bench(`${count} dependenc(ies)`, () => {
      observe(computed.get());
    });
  }

  const bigSource = createStore(bigBase);
  const computedOverBig = createStore(({ use }) => use(bigSource).order.length);
  computedOverBig.get();

  bench(`1 dependency holding ${BIG_SIZE} items`, () => {
    observe(computedOverBig.get());
  });
});

describe('computed store: recompute after a dependency changed', () => {
  for (const count of [1, 5, 20]) {
    const sources = makeSources(count);
    const computed = createStore(({ use }) => sources.reduce((sum, s) => sum + use(s), 0));
    computed.get();

    let counter = 0;

    bench(`${count} dependenc(ies)`, () => {
      sources[0]!.set(counter++);
      observe(computed.get());
    });
  }
});

describe('computed store: notify subscribers after a dependency changed', () => {
  for (const count of [1, 10, 100]) {
    const sources = makeSources(5);
    const computed = createStore(({ use }) => sources.reduce((sum, s) => sum + use(s), 0));

    for (let index = 0; index < count; index++) {
      computed.subscribe(observe, { runNow: false });
    }

    let counter = 0;

    bench(`5 dependencies, ${count} subscriber(s)`, () => {
      sources[0]!.set(counter++);
    });
  }
});
