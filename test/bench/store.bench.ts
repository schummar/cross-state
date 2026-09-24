import { benchGroup, type BenchCases } from './_baseline.ts';
import { createBigState, createSmallState, cycler, observe, type BigState } from './_fixtures.ts';
import { createStore, type Store } from 'cross-state';
import { strictEqual } from 'cross-state';
import { test, describe } from 'vite-plus/test';

const VARIANTS = 64;
const BIG_SIZE = 1000;

const smallStates = Array.from({ length: VARIANTS }, (_, index) => createSmallState(index));

const bigBase = createBigState(BIG_SIZE);

/** Equal by value but a fresh object graph each time, so `deepEqual` has to walk the whole tree. */
const bigClones = [createBigState(BIG_SIZE), createBigState(BIG_SIZE)];

/** Differs in the first compared key, so `deepEqual` bails out immediately. */
const bigShallowChanges = Array.from({ length: VARIANTS }, (_, index) => ({
  ...bigBase,
  version: index + 1,
}));

/** Differs only in the last item, so `deepEqual` walks everything before finding it. */
const bigDeepChanges = Array.from({ length: VARIANTS }, (_, index) => ({
  ...bigBase,
  items: {
    ...bigBase.items,
    [`item-${BIG_SIZE - 1}`]: { ...bigBase.items[`item-${BIG_SIZE - 1}`]!, value: index + 1 },
  },
}));

function addSubscribers<T>(
  store: Store<T>,
  count: number,
  options?: { equals?: (a: T, b: T) => boolean },
): void {
  for (let index = 0; index < count; index++) {
    store.subscribe(observe, { runNow: false, ...options });
  }
}

describe('store.set', () => {
  test('no subscribers', async (ctx) => {
    const small = createStore(createSmallState());
    const nextSmall = cycler(smallStates);
    const big = createStore(bigBase);
    const nextBig = cycler(bigShallowChanges);

    await benchGroup(ctx, {
      'small state, whole value': () => small.set(nextSmall()),
      'small state, by path': () => small.set('count', small.get().count + 1),
      'small state, by updater': () => small.set((state) => ({ ...state, count: state.count + 1 })),
      [`big state (${BIG_SIZE} items), whole value`]: () => big.set(nextBig()),
      [`big state (${BIG_SIZE} items), by path`]: () =>
        big.set('meta.updatedAt', big.get().meta.updatedAt + 1),
    });
  });

  test('notify subscribers, small state', async (ctx) => {
    const cases: BenchCases = {};

    for (const count of [1, 10, 100]) {
      const store = createStore(createSmallState());
      addSubscribers(store, count);

      const next = cycler(smallStates);
      cases[`${count} subscriber(s)`] = () => store.set(next());
    }

    await benchGroup(ctx, cases);
  });

  test(`notify subscribers, big state (${BIG_SIZE} items)`, async (ctx) => {
    const cases: BenchCases = {};

    for (const count of [1, 10]) {
      const deepEqualStore = createStore(bigBase);
      addSubscribers(deepEqualStore, count);
      const nextDeepEqual = cycler(bigDeepChanges);

      const strictEqualStore = createStore(bigBase, { equals: strictEqual });
      addSubscribers(strictEqualStore, count);
      const nextStrictEqual = cycler(bigDeepChanges);

      cases[`${count} subscriber(s), deepEqual (default)`] = () =>
        deepEqualStore.set(nextDeepEqual());
      cases[`${count} subscriber(s), strictEqual`] = () => strictEqualStore.set(nextStrictEqual());
    }

    await benchGroup(ctx, cases);
  });

  test(`change position in big state (${BIG_SIZE} items), 1 subscriber`, async (ctx) => {
    const early = createStore(bigBase);
    addSubscribers(early, 1);
    const nextEarly = cycler(bigShallowChanges);

    const late = createStore(bigBase);
    addSubscribers(late, 1);
    const nextLate = cycler(bigDeepChanges);

    const unchanged = createStore(bigBase);
    addSubscribers(unchanged, 1);
    const nextUnchanged = cycler(bigClones);

    await benchGroup(ctx, {
      'change in first compared key': () => early.set(nextEarly()),
      'change in last item': () => late.set(nextLate()),
      'no actual change, fresh object graph': () => unchanged.set(nextUnchanged()),
    });
  });
});

describe('store', () => {
  test('get', async (ctx) => {
    const small = createStore(createSmallState());
    const big = createStore(bigBase);

    await benchGroup(ctx, {
      'static store, small state': () => observe(small.get()),
      [`static store, big state (${BIG_SIZE} items)`]: () => observe(big.get()),
    });
  });

  test('subscribe / unsubscribe churn', async (ctx) => {
    const small = createStore(createSmallState());
    const big: Store<BigState> = createStore(bigBase);

    await benchGroup(ctx, {
      'small state, runNow': () => small.subscribe(observe)(),
      'small state, runNow: false': () => small.subscribe(observe, { runNow: false })(),
      [`big state (${BIG_SIZE} items), runNow: false`]: () =>
        big.subscribe(observe, { runNow: false })(),
    });
  });

  test('subscribe / unsubscribe churn with existing subscribers', async (ctx) => {
    const cases: BenchCases = {};

    for (const count of [10, 100, 1000]) {
      const store = createStore(createSmallState());
      addSubscribers(store, count);

      cases[`${count} existing subscriber(s)`] = () =>
        store.subscribe(observe, { runNow: false })();
    }

    await benchGroup(ctx, cases);
  });

  test('methods', async (ctx) => {
    const list = createStore(Array.from({ length: 100 }, (_, index) => index));
    const record = createStore<Record<string, number>>(
      Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`key-${index}`, index])),
    );

    await benchGroup(ctx, {
      'array push + pop on 100 entries': () => {
        list.push(0);
        list.pop();
      },
      'record set on 100 entries': () => record.set('key-50', record.get()['key-50']! + 1),
    });
  });
});
