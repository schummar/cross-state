import { describe, expect, test } from 'vitest';
import { store } from '../../src';
import { immerActions } from '../../src/immer';

describe('store methods', () => {
  describe('map actions', () => {
    test('set', () => {
      const state = store(new Map([['x', { x: 1 }]]));

      state.set('y', { x: 2 });
      expect(state.get()).toEqual(
        new Map([
          ['x', { x: 1 }],
          ['y', { x: 2 }],
        ])
      );
    });

    test('delete', () => {
      const state = store(new Map([['x', 1]]));

      state.delete('x');
      expect(state.get()).toEqual(new Map());
    });

    test('clear', () => {
      const state = store(new Map([['x', 1]]));

      state.clear();
      expect(state.get()).toEqual(new Map());
    });
  });

  describe('set actions', () => {
    test('add', () => {
      const state = store(new Set([{ x: 1 }]));

      state.add({ x: 2 });
      expect(state.get()).toEqual(new Set([{ x: 1 }, { x: 2 }]));
    });

    test('delete', () => {
      const state = store(new Set([1]));

      state.delete(1);
      expect(state.get()).toEqual(new Set());
    });

    test('clear', () => {
      const state = store(new Set([1]));

      state.clear();
      expect(state.get()).toEqual(new Set());
    });
  });

  describe('array actions', () => {
    test('push', () => {
      const state = store([{ x: 1 }]);

      state.push({ x: 2 });
      expect(state.get()).toEqual([{ x: 1 }, { x: 2 }]);
    });

    test('pop', () => {
      const state = store([1]);

      state.pop();
      expect(state.get()).toEqual([]);
    });

    test('shift', () => {
      const state = store([1]);

      state.shift();
      expect(state.get()).toEqual([]);
    });

    test('unshift', () => {
      const state = store([1]);

      state.unshift(2);
      expect(state.get()).toEqual([2, 1]);
    });

    test('reverse', () => {
      const state = store([1, 2]);

      state.reverse();
      expect(state.get()).toEqual([2, 1]);
    });

    test('sort', () => {
      const state = store([2, 1]);

      state.sort();
      expect(state.get()).toEqual([1, 2]);
    });

    test('splice', () => {
      const state = store([1, 2]);

      state.splice(0, 1, 3);
      expect(state.get()).toEqual([3, 2]);
    });
  });

  describe('record actions', () => {
    test('set', () => {
      const state = store({ x: 1 });

      state.set('x', 2);
      expect(state.get()).toEqual({ x: 2 });
    });

    test('set with function', () => {
      const state = store({ x: 1 });

      state.set('x', (x) => x + 1);
      expect(state.get()).toEqual({ x: 2 });
    });

    test('delete', () => {
      const state = store<{ x?: number }>({ x: 1 });

      state.delete('x');
      expect(state.get()).toEqual({});
    });

    test('clear', () => {
      const state = store<{ x?: number }>({ x: 1 });

      state.clear();
      expect(state.get()).toEqual({});
    });
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
