import { describe, expect, test } from 'vitest';
import { store } from '../../src';
import { immerActions } from '../../src/immer';

describe('store methods', () => {
  test('map actions', () => {
    const state = store(new Map([['x', 1]]));

    state.set('y', 2);
    expect(state.get()).toEqual(
      new Map([
        ['x', 1],
        ['y', 2],
      ])
    );
  });

  test('set actions', () => {
    const state = store(new Set([1]));

    state.add(2);
    expect(state.get()).toEqual(new Set([1, 2]));
  });

  test('array actions', () => {
    const state = store([1]);

    state.push(2);
    expect(state.get()).toEqual([1, 2]);
  });

  test('record actions', () => {
    const state = store({ x: 1 });

    state.set('x', 2);
    expect(state.get()).toEqual({ x: 2 });
  });

  test('custom reducer', () => {
    const state = store(
      { x: 1 },
      {
        methods: {
          inc() {
            this.update((state) => ({ ...state, x: state.x + 1 }));
          },
        },
      }
    );

    state.inc();

    expect(state.get()).toEqual({ x: 2 });
  });

  test('nested customer reducers', () => {
    const state = store(
      { x: 1 },
      {
        methods: {
          inc() {
            this.update((state) => ({ ...state, x: state.x + 1 }));
          },
          incAndDouble() {
            this.inc();
            this.update((state) => ({ ...state, x: state.x * 2 }));
          },
        },
      }
    );

    state.incAndDouble();

    expect(state.get()).toEqual({ x: 4 });
  });

  test('custom reducer and record actions', () => {
    const state = store(
      { x: 1 },
      {
        methods: {
          inc() {
            this.set('x', (x) => x + 1);
          },
        },
      }
    );

    state.set('x', 2);
    state.inc();
    expect(state.get()).toEqual({ x: 3 });
  });

  test('custom reducer and record actions and immer actions', () => {
    const state = store(
      { x: 1 },
      {
        methods: {
          ...immerActions,
          inc() {
            this.immerUpdate((state) => {
              state.x++;
            });
          },
        },
      }
    );

    state.inc();
    expect(state.get()).toEqual({ x: 2 });
  });
});
