import { createBigState, createSmallState, cycler, observe, type BigState } from './_fixtures';
import { createStore, type Store } from '@core/store';
import { strictEqual } from '@lib/equals';
import { bench, describe } from 'vite-plus/test';

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

describe('store.set: no subscribers', () => {
  const small = createStore(createSmallState());
  const nextSmall = cycler(smallStates);
  const big = createStore(bigBase);
  const nextBig = cycler(bigShallowChanges);

  bench('small state, whole value', () => {
    small.set(nextSmall());
  });

  bench('small state, by path', () => {
    small.set('count', small.get().count + 1);
  });

  bench('small state, by updater', () => {
    small.set((state) => ({ ...state, count: state.count + 1 }));
  });

  bench(`big state (${BIG_SIZE} items), whole value`, () => {
    big.set(nextBig());
  });

  bench(`big state (${BIG_SIZE} items), by path`, () => {
    big.set('meta.updatedAt', big.get().meta.updatedAt + 1);
  });
});

describe('store.set: notify subscribers, small state', () => {
  for (const count of [1, 10, 100]) {
    const store = createStore(createSmallState());
    addSubscribers(store, count);

    const next = cycler(smallStates);

    bench(`${count} subscriber(s)`, () => {
      store.set(next());
    });
  }
});

describe(`store.set: notify subscribers, big state (${BIG_SIZE} items)`, () => {
  for (const count of [1, 10]) {
    const deepEqualStore = createStore(bigBase);
    addSubscribers(deepEqualStore, count);
    const nextDeepEqual = cycler(bigDeepChanges);

    const strictEqualStore = createStore(bigBase, { equals: strictEqual });
    addSubscribers(strictEqualStore, count);
    const nextStrictEqual = cycler(bigDeepChanges);

    bench(`${count} subscriber(s), deepEqual (default)`, () => {
      deepEqualStore.set(nextDeepEqual());
    });

    bench(`${count} subscriber(s), strictEqual`, () => {
      strictEqualStore.set(nextStrictEqual());
    });
  }
});

describe(`store.set: change position in big state (${BIG_SIZE} items), 1 subscriber`, () => {
  const early = createStore(bigBase);
  addSubscribers(early, 1);
  const nextEarly = cycler(bigShallowChanges);

  const late = createStore(bigBase);
  addSubscribers(late, 1);
  const nextLate = cycler(bigDeepChanges);

  const unchanged = createStore(bigBase);
  addSubscribers(unchanged, 1);
  const nextUnchanged = cycler(bigClones);

  bench('change in first compared key', () => {
    early.set(nextEarly());
  });

  bench('change in last item', () => {
    late.set(nextLate());
  });

  bench('no actual change, fresh object graph', () => {
    unchanged.set(nextUnchanged());
  });
});

describe('store.get', () => {
  const small = createStore(createSmallState());
  const big = createStore(bigBase);

  bench('static store, small state', () => {
    observe(small.get());
  });

  bench(`static store, big state (${BIG_SIZE} items)`, () => {
    observe(big.get());
  });
});

describe('subscribe / unsubscribe churn', () => {
  const small = createStore(createSmallState());
  const big: Store<BigState> = createStore(bigBase);

  bench('small state, runNow', () => {
    small.subscribe(observe)();
  });

  bench('small state, runNow: false', () => {
    small.subscribe(observe, { runNow: false })();
  });

  bench(`big state (${BIG_SIZE} items), runNow: false`, () => {
    big.subscribe(observe, { runNow: false })();
  });
});

describe('store methods', () => {
  const list = createStore(Array.from({ length: 100 }, (_, index) => index));
  const record = createStore<Record<string, number>>(
    Object.fromEntries(Array.from({ length: 100 }, (_, index) => [`key-${index}`, index])),
  );

  bench('array push + pop on 100 entries', () => {
    list.push(0);
    list.pop();
  });

  bench('record set on 100 entries', () => {
    record.set('key-50', record.get()['key-50']! + 1);
  });
});
