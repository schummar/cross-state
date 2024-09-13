import type { OptionalProperties } from '@lib/typeHelpers';
import { describe, expect, test } from 'vitest';
import { createStore } from '../../src/core/store';
import { mutativeMethods } from '../../src/mutative';
import '../../src/mutative/register';

describe('store methods', () => {
  describe('map methods', () => {
    test('set', () => {
      const state = createStore(new Map([['x', { x: 1 }]]));

      state.set('y', { x: 2 });
      expect(state.get()).toEqual(
        new Map([
          ['x', { x: 1 }],
          ['y', { x: 2 }],
        ]),
      );
    });

    test('delete', () => {
      const state = createStore(new Map([['x', 1]]));

      state.delete('x');
      expect(state.get()).toEqual(new Map());
    });

    test('clear', () => {
      const state = createStore(new Map([['x', 1]]));

      state.clear();
      expect(state.get()).toEqual(new Map());
    });
  });

  describe('set methods', () => {
    test('add', () => {
      const state = createStore(new Set([{ x: 1 }]));

      state.add({ x: 2 });
      expect(state.get()).toEqual(new Set([{ x: 1 }, { x: 2 }]));
    });

    test('delete', () => {
      const state = createStore(new Set([1]));

      state.delete(1);
      expect(state.get()).toEqual(new Set());
    });

    test('clear', () => {
      const state = createStore(new Set([1]));

      state.clear();
      expect(state.get()).toEqual(new Set());
    });
  });

  describe('array methods', () => {
    test('push', () => {
      const state = createStore([{ x: 1 }]);

      state.push({ x: 2 });
      expect(state.get()).toEqual([{ x: 1 }, { x: 2 }]);
    });

    test('pop', () => {
      const state = createStore([1]);

      state.pop();
      expect(state.get()).toEqual([]);
    });

    test('shift', () => {
      const state = createStore([1]);

      state.shift();
      expect(state.get()).toEqual([]);
    });

    test('unshift', () => {
      const state = createStore([1]);

      state.unshift(2);
      expect(state.get()).toEqual([2, 1]);
    });

    test('reverse', () => {
      const state = createStore([1, 2]);

      state.reverse();
      expect(state.get()).toEqual([2, 1]);
    });

    test('sort', () => {
      const state = createStore([2, 1]);

      state.sort();
      expect(state.get()).toEqual([1, 2]);
    });

    test('splice', () => {
      const state = createStore([1, 2]);

      state.splice(0, 1, 3);
      expect(state.get()).toEqual([3, 2]);
    });
  });

  describe('record methods for objects', () => {
    test('set', () => {
      const state = createStore({ x: 1 });

      state.set('x', 2);
      expect(state.get()).toEqual({ x: 2 });
    });

    test('set with function', () => {
      const state = createStore({ x: 1 });

      state.set('x', (x) => x + 1);
      expect(state.get()).toEqual({ x: 2 });
    });

    test('delete', () => {
      const state = createStore<{ x?: number }>({ x: 1 });

      state.delete('x');
      expect(state.get()).toEqual({});
    });

    test('clear', () => {
      const state = createStore<{ x?: number }>({ x: 1 });

      state.clear();
      expect(state.get()).toEqual({});
    });

    test('clear non clearable', () => {
      const state = createStore<{ x: number }>({ x: 1 });

      /** @ts-expect-error x is required */
      state.clear();
      expect(state.get()).toEqual({});
    });
  });

  describe('record methods for dicts', () => {
    test('set', () => {
      const state = createStore<Record<string, number>>({ x: 1 });

      state.set('x', 2);
      state.set('y', 3);
      expect(state.get()).toEqual({ x: 2, y: 3 });
    });

    test('set with function', () => {
      const state = createStore<Record<string, number>>({ x: 1 });

      /** @ts-expect-error x is possibly undefined */
      state.set('x', (x) => x + 1);
      state.set('y', (y) => (y ?? 0) + 1);
      expect(state.get()).toEqual({ x: 2, y: 1 });
    });

    test('delete', () => {
      const state = createStore<Record<string, number>>({ x: 1 });

      state.delete('x');
      expect(state.get()).toEqual({});
    });

    test('clear', () => {
      const state = createStore<Record<string, number>>({ x: 1 });

      state.clear();
      expect(state.get()).toEqual({});
    });
  });

  test('custom reducer', () => {
    const state = createStore(
      { x: 1 },
      {
        methods: {
          inc() {
            this.set((x) => ({ ...x, x: x.x + 1 }));
          },
        },
      },
    );

    state.inc();

    expect(state.get()).toEqual({ x: 2 });
  });

  test('nested customer reducers', () => {
    const state = createStore(
      { x: 1 },
      {
        methods: {
          inc() {
            this.set((x) => ({ ...x, x: x.x + 1 }));
          },
          incAndDouble() {
            this.inc();
            this.set((x) => ({ ...x, x: x.x * 2 }));
          },
        },
      },
    );

    state.incAndDouble();

    expect(state.get()).toEqual({ x: 4 });
  });

  test('custom reducer and record methods', () => {
    const state = createStore(
      { x: 1 },
      {
        methods: {
          inc() {
            this.set('x', (x) => x + 1);
          },
        },
      },
    );

    state.set('x', 2);
    state.inc();
    expect(state.get()).toEqual({ x: 3 });
  });

  test('custom reducer and mutative methods', () => {
    const state = createStore(
      { x: 1 },
      {
        methods: {
          ...mutativeMethods,
          inc() {
            this.update((x) => {
              x.x++;
            });
          },
        },
      },
    );

    state.inc();
    expect(state.get()).toEqual({ x: 2 });
  });

  test('combine array and mutative methods', () => {
    const state = createStore([{ x: 1 }], {
      methods: {
        ...mutativeMethods,
        incAndPush() {
          this.update((x) => {
            if (x[0]) {
              x[0].x++;
            }
          });

          this.push({ x: 2 });
        },
      },
    });

    state.incAndPush();
    expect(state.get()).toEqual([{ x: 2 }, { x: 2 }]);
  });

  test('nested mutative with array key', () => {
    const state = createStore({ x: { y: [1] } });
    state.update(['x', 'y'], (y) => {
      y.push(2);
    });

    expect(state.get()).toEqual({ x: { y: [1, 2] } });
  });

  test('nested mutative with string key', () => {
    const state = createStore({ x: { y: [1] } });
    state.update('x.y', (y) => {
      y.push(2);
    });

    expect(state.get()).toEqual({ x: { y: [1, 2] } });
  });

  test('mutative inline', () => {
    const state = createStore({ x: 1 });
    // eslint-disable-next-line no-return-assign
    state.update((state) => (state.x = 2));

    expect(state.get()).toEqual({ x: 2 });
  });
});
