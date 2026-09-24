import { benchGroup } from './_baseline.ts';
import {
  createBigState,
  createSmallState,
  cycler,
  type BigState,
  type SmallState,
} from './_fixtures.ts';
import { act, render } from '@testing-library/react';
import { createStore, type Store } from 'cross-state';
import { useStore } from 'cross-state/react';
import { test, describe } from 'vite-plus/test';

const VARIANTS = 64;
const BIG_SIZE = 1000;
const CONSUMERS = 50;

const bigBase = createBigState(BIG_SIZE);

/** Only `version` changes, so no consumer's selected value actually changes. */
const bigShallowChanges = Array.from({ length: VARIANTS }, (_, index) => ({
  ...bigBase,
  version: index + 1,
}));

/** Only the last item changes, which none of the consumers select. */
const bigDeepChanges = Array.from({ length: VARIANTS }, (_, index) => ({
  ...bigBase,
  items: {
    ...bigBase.items,
    [`item-${BIG_SIZE - 1}`]: { ...bigBase.items[`item-${BIG_SIZE - 1}`]!, value: index + 1 },
  },
}));

/** Equal by value but a fresh object graph each time. */
const bigClones = [createBigState(BIG_SIZE), createBigState(BIG_SIZE)];

function SmallConsumer({ store }: { store: Store<SmallState> }) {
  const count = useStore(store, (state) => state.count);
  return <span>{count}</span>;
}

function WholeStateConsumer({ store }: { store: Store<SmallState> }) {
  const state = useStore(store);
  return <span>{state.count}</span>;
}

function ItemConsumer({ store, id }: { store: Store<BigState>; id: string }) {
  const value = useStore(store, (state) => state.items[id]?.value);
  return <span>{value}</span>;
}

function TrackingConsumer({ store, id }: { store: Store<BigState>; id: string }) {
  const state = useStore(store, { enableTrackingProxy: true });
  return <span>{state.items[id]?.value}</span>;
}

function repeat(count: number, render_: (index: number) => React.ReactNode): React.ReactNode[] {
  return Array.from({ length: count }, (_, index) => render_(index));
}

describe('useStore', () => {
  test(`${CONSUMERS} consumers of a small store`, async (ctx) => {
    const selectorStore = createStore(createSmallState());
    render(
      <>
        {repeat(CONSUMERS, (index) => (
          <SmallConsumer key={index} store={selectorStore} />
        ))}
      </>,
    );

    const wholeStore = createStore(createSmallState());
    render(
      <>
        {repeat(CONSUMERS, (index) => (
          <WholeStateConsumer key={index} store={wholeStore} />
        ))}
      </>,
    );

    let counter = 0;

    await benchGroup(ctx, {
      'selector, value changes': () => act(() => selectorStore.set('count', counter++)),
      'whole state, value changes': () => act(() => wholeStore.set('count', counter++)),
      'selector, value stays equal': () =>
        act(() => selectorStore.set('label', `label-${counter++}`)),
    });
  });

  test(`${CONSUMERS} consumers of a big store (${BIG_SIZE} items)`, async (ctx) => {
    const selectorStore = createStore(bigBase);
    render(
      <>
        {repeat(CONSUMERS, (index) => (
          <ItemConsumer key={index} store={selectorStore} id={`item-${index}`} />
        ))}
      </>,
    );
    const nextSelector = cycler(bigShallowChanges);

    const trackingStore = createStore(bigBase);
    render(
      <>
        {repeat(CONSUMERS, (index) => (
          <TrackingConsumer key={index} store={trackingStore} id={`item-${index}`} />
        ))}
      </>,
    );
    const nextTracking = cycler(bigShallowChanges);

    await benchGroup(ctx, {
      'selector, unrelated change': () => act(() => selectorStore.set(nextSelector())),
      'tracking proxy, unrelated change': () => act(() => trackingStore.set(nextTracking())),
    });
  });

  test(`${CONSUMERS} consumers of a big store (${BIG_SIZE} items), deep change`, async (ctx) => {
    const selectorStore = createStore(bigBase);
    render(
      <>
        {repeat(CONSUMERS, (index) => (
          <ItemConsumer key={index} store={selectorStore} id={`item-${index}`} />
        ))}
      </>,
    );
    const nextSelector = cycler(bigDeepChanges);

    const trackingStore = createStore(bigBase);
    render(
      <>
        {repeat(CONSUMERS, (index) => (
          <TrackingConsumer key={index} store={trackingStore} id={`item-${index}`} />
        ))}
      </>,
    );
    const nextTracking = cycler(bigDeepChanges);

    const cloneStore = createStore(bigBase);
    render(
      <>
        {repeat(CONSUMERS, (index) => (
          <ItemConsumer key={index} store={cloneStore} id={`item-${index}`} />
        ))}
      </>,
    );
    const nextClone = cycler(bigClones);

    await benchGroup(ctx, {
      'selector, change in last item': () => act(() => selectorStore.set(nextSelector())),
      'tracking proxy, change in last item': () => act(() => trackingStore.set(nextTracking())),
      'selector, no actual change, fresh object graph': () =>
        act(() => cloneStore.set(nextClone())),
    });
  });

  test('mount cost', async (ctx) => {
    const store = createStore(bigBase);

    await benchGroup(ctx, {
      [`mount ${CONSUMERS} consumers`]: () => {
        const { unmount } = render(
          <>
            {repeat(CONSUMERS, (index) => (
              <ItemConsumer key={index} store={store} id={`item-${index}`} />
            ))}
          </>,
        );
        unmount();
      },
    });
  });
});
