import { benchGroup, type BenchCases } from './_baseline.ts';
import { createBigState, createSmallState, cycler, observe, type BenchItem } from './_fixtures.ts';
import { createStore, type Store } from 'cross-state';
import { test, describe } from 'vite-plus/test';

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

describe('store.map', () => {
  test('propagate a source change', async (ctx) => {
    const byPath = createStore(createSmallState());
    byPath.map('count').subscribe(observe, { runNow: false });

    const bySelector = createStore(createSmallState());
    bySelector.map((state) => state.count).subscribe(observe, { runNow: false });

    const chained = createStore({ a: { b: { c: { d: { e: 0 } } } } });
    chained
      .map((state) => state.a)
      .map((state) => state.b)
      .map((state) => state.c)
      .map((state) => state.d)
      .map((state) => state.e)
      .subscribe(observe, { runNow: false });

    let counter = 0;

    await benchGroup(ctx, {
      'map by path, 1 subscriber': () => byPath.set('count', counter++),
      'map by selector, 1 subscriber': () => bySelector.set('count', counter++),
      'chain of 5 maps, 1 subscriber': () => chained.set(['a', 'b', 'c', 'd', 'e'], counter++),
    });
  });

  test('many subscribers on the mapped store', async (ctx) => {
    const cases: BenchCases = {};

    for (const count of [1, 10, 100]) {
      const source = createStore(createSmallState());
      const mapped = source.map((state) => state.count);

      for (let index = 0; index < count; index++) {
        mapped.subscribe(observe, { runNow: false });
      }

      let counter = 0;
      cases[`${count} subscriber(s)`] = () => source.set('count', counter++);
    }

    await benchGroup(ctx, cases);
  });

  test(`selector over big state (${BIG_SIZE} items)`, async (ctx) => {
    const source = createStore(bigBase);
    const selectedItem: Store<BenchItem | undefined> = source.map(
      (state) => state.items['item-500'],
    );
    selectedItem.subscribe(observe, { runNow: false });
    const nextUnrelated = cycler(bigShallowChanges);

    const selectedCount = source.map((state) => state.order.length);
    selectedCount.subscribe(observe, { runNow: false });

    await benchGroup(ctx, {
      'select one item, unrelated change': () => source.set(nextUnrelated()),
      'read selected item (cached)': () => observe(selectedItem.get()),
      'read derived scalar (cached)': () => observe(selectedCount.get()),
    });
  });
});

describe('computed store', () => {
  test('get() while up to date', async (ctx) => {
    const cases: BenchCases = {};

    for (const count of [1, 5, 20]) {
      const sources = makeSources(count);
      const computed = createStore(({ use }) => sources.reduce((sum, s) => sum + use(s), 0));
      computed.get();

      cases[`${count} dependenc(ies)`] = () => observe(computed.get());
    }

    const bigSource = createStore(bigBase);
    const computedOverBig = createStore(({ use }) => use(bigSource).order.length);
    computedOverBig.get();

    cases[`1 dependency holding ${BIG_SIZE} items`] = () => observe(computedOverBig.get());

    await benchGroup(ctx, cases);
  });

  test('recompute after a dependency changed', async (ctx) => {
    const cases: BenchCases = {};

    for (const count of [1, 5, 20]) {
      const sources = makeSources(count);
      const computed = createStore(({ use }) => sources.reduce((sum, s) => sum + use(s), 0));
      computed.get();

      let counter = 0;
      cases[`${count} dependenc(ies)`] = () => {
        sources[0]!.set(counter++);
        observe(computed.get());
      };
    }

    await benchGroup(ctx, cases);
  });

  test('notify subscribers after a dependency changed', async (ctx) => {
    const cases: BenchCases = {};

    for (const count of [1, 10, 100]) {
      const sources = makeSources(5);
      const computed = createStore(({ use }) => sources.reduce((sum, s) => sum + use(s), 0));

      for (let index = 0; index < count; index++) {
        computed.subscribe(observe, { runNow: false });
      }

      let counter = 0;
      cases[`5 dependencies, ${count} subscriber(s)`] = () => sources[0]!.set(counter++);
    }

    await benchGroup(ctx, cases);
  });
});
