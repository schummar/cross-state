import {
  createBigState,
  createSmallState,
  cycler,
  type BigState,
  type SmallState,
} from './_fixtures';
import { createStore, type Store } from '@core/store';
import { useStore } from '@react/useStore';
import { act, render } from '@testing-library/react';
import { bench, describe } from 'vite-plus/test';

const VARIANTS = 64;
const BIG_SIZE = 1000;
const CONSUMERS = 50;

const bigBase = createBigState(BIG_SIZE);

/** Only `version` changes, so no consumer's selected value actually changes. */
const bigShallowChanges = Array.from({ length: VARIANTS }, (_, index) => ({
  ...bigBase,
  version: index + 1,
}));

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

describe(`useStore: ${CONSUMERS} consumers of a small store`, () => {
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

  bench('selector, value changes', () => {
    act(() => {
      selectorStore.set('count', counter++);
    });
  });

  bench('whole state, value changes', () => {
    act(() => {
      wholeStore.set('count', counter++);
    });
  });

  bench('selector, value stays equal', () => {
    act(() => {
      selectorStore.set('label', `label-${counter++}`);
    });
  });
});

describe(`useStore: ${CONSUMERS} consumers of a big store (${BIG_SIZE} items)`, () => {
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

  bench('selector, unrelated change', () => {
    act(() => {
      selectorStore.set(nextSelector());
    });
  });

  bench('tracking proxy, unrelated change', () => {
    act(() => {
      trackingStore.set(nextTracking());
    });
  });
});

describe('useStore: mount cost', () => {
  const store = createStore(bigBase);

  bench(`mount ${CONSUMERS} consumers`, () => {
    const { unmount } = render(
      <>
        {repeat(CONSUMERS, (index) => (
          <ItemConsumer key={index} store={store} id={`item-${index}`} />
        ))}
      </>,
    );
    unmount();
  });
});
