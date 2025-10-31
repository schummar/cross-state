import { act, render, screen } from '@testing-library/react';
import { useCallback, useState, type ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { createStore, strictEqual } from '../../src';
import { useStore } from '../../src/react';

function c<T>(name: string, before: T, after1: T, after2: T, select: (t: T) => ReactNode) {
  return [name, before, after1, after2, select] as const;
}

describe('useStore', () => {
  describe.each<readonly [string, any, any, any, (t: any) => ReactNode]>([
    //
    c('primitive', 0, 1, 0, (s) => s),
    c('object', { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, (s) => s.x),
    c(
      'object with optionals',
      { a: { b: { c: 1 } } },
      { a: undefined },
      { a: { b: { c: 1 } } },
      (s) => s.a?.b.c,
    ),
    c('array', [1, 2, 3], [1, 2, 4], [1, 2, 3, 4], (s) => s[2]),
    c('array.length', [1, 2, 3], [1, 2, 3, 4], [1, 2, 4], (s) => s.length),
  ])('useStore %s', (_name, before, after1, after2, select) => {
    test('changed', async () => {
      const store = createStore(before);

      const Component = vi.fn(function Component() {
        const v = useStore(store.map(select));

        return <div data-testid="div">{v}</div>;
      });

      render(<Component />);
      const div = screen.getByTestId('div');

      act(() => {
        store.set(after1);
      });

      expect(div.textContent).toBe(String(select(after1) ?? ''));
      expect(Component.mock.calls.length).toBe(2);
    });

    test('same', async () => {
      const store = createStore(before);

      const Component = vi.fn(function Component() {
        const v = useStore(store.map(select));

        return <div data-testid="div">{v}</div>;
      });

      render(<Component />);
      const div = screen.getByTestId('div');

      act(() => {
        store.set(after2);
      });

      expect(div.textContent).toBe(String(select(after2)));
      expect(Component.mock.calls.length).toBe(1);
    });

    test('same without selector', async () => {
      const store = createStore(before);

      const Component = vi.fn(function Component() {
        const v = useStore(store, { enableTrackingProxy: true });

        return <div data-testid="div">{select(v)}</div>;
      });

      render(<Component />);
      const div = screen.getByTestId('div');

      act(() => {
        store.set(after2);
      });

      expect(div.textContent).toBe(String(select(after2)));
      expect(Component.mock.calls.length).toBe(1);
    });
  });

  test('primitive/object union', async () => {
    const store = createStore<{ a: string } | string>({ a: 'a' });

    const Component = vi.fn(function Component() {
      const value = useStore(store);

      return <div data-testid="div">{JSON.stringify(value)}</div>;
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    act(() => {
      store.set('a');
    });

    expect(div.textContent).toBe('"a"');
    expect(Component.mock.calls.length).toBe(2);
  });

  test('inline selector', async () => {
    const store = createStore({ a: 1, b: 2 });

    const Component = vi.fn(function Component() {
      const value = useStore(store.map((s) => s.a));

      return <div data-testid="div">{value}</div>;
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    act(() => {
      store.set({ a: 2, b: 2 });
    });

    expect(div.textContent).toBe('2');
    expect(Component.mock.calls.length).toBe(2);
  });

  test('with selector as argument', async () => {
    const store = createStore({ a: 1, b: 2 });

    const Component = vi.fn(function Component() {
      const value = useStore(store, (s) => s.a);

      return <div data-testid="div">{value}</div>;
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    act(() => {
      store.set({ a: 2, b: 2 });
    });

    expect(div.textContent).toBe('2');
    expect(Component.mock.calls.length).toBe(2);
  });

  test('with mapping and selector as argument', async () => {
    const store = createStore({ a: 1, b: 2 });

    const Component = vi.fn(function Component() {
      const value = useStore(
        store.map((s) => s.a),
        (s) => s + 1,
      );

      return <div data-testid="div">{value}</div>;
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    act(() => {
      store.set({ a: 2, b: 2 });
    });

    expect(div.textContent).toBe('3');
    expect(Component.mock.calls.length).toBe(2);
  });

  test('fall back to store equals', async () => {
    const store = createStore({ a: 1 }, { equals: strictEqual });

    const Component = vi.fn(function Component() {
      const value = useStore(store);

      return <div data-testid="div">{value.a}</div>;
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    act(() => {
      store.set({ a: 1 });
    });

    expect(div.textContent).toBe('1');
    expect(Component.mock.calls.length).toBe(2);
  });

  test('useStore with external value', () => {
    const store = createStore(0);

    const Component = vi.fn(function Component() {
      const [otherValue, setOtherValue] = useState(0);
      const value = useStore(store, (x) => x + otherValue);

      return (
        <div data-testid="div" onClick={() => setOtherValue(1)}>
          {value}
        </div>
      );
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    expect(div.textContent).toBe('0');
    expect(Component.mock.calls.length).toBe(1);

    act(() => {
      div.click();
    });

    expect(div.textContent).toBe('1');
    expect(Component.mock.calls.length).toBe(2);
  });

  test('memoized selector helps to avoid reevaluations', () => {
    const store = createStore(0);
    let evaluationCount = 0;

    const Component = function Component() {
      const [otherValue, setOtherValue] = useState(0);
      const halfValue = Math.floor(otherValue / 2);

      const selector = useCallback(
        (x: number) => {
          evaluationCount++;
          return x + halfValue;
        },
        [halfValue],
      );

      const value = useStore(store, selector);

      return (
        <div data-testid="div" onClick={() => setOtherValue((v) => v + 1)}>
          {value}
        </div>
      );
    };

    render(<Component />);
    const div = screen.getByTestId('div');

    expect(div.textContent).toBe('0');
    expect(evaluationCount).toBe(1);

    act(() => {
      div.click();
    });

    expect(div.textContent).toBe('0');
    expect(evaluationCount).toBe(1);

    act(() => {
      div.click();
    });

    expect(div.textContent).toBe('1');
    expect(evaluationCount).toBe(2);

    act(() => {
      store.set(1);
    });

    expect(div.textContent).toBe('2');
    expect(evaluationCount).toBe(3);
  });

  test('storeValueEquals help to avoid expensive selector reevaluations', () => {
    const store = createStore({ x: 0, y: 0 });
    const selector = vi.fn((s: { x: number; y: number }) => s.x);

    const Component = function Component() {
      const value = useStore(store, selector, {
        storeValueEquals: (a, b) => a.x === b.x,
      });

      return <div data-testid="div">{value}</div>;
    };

    render(<Component />);
    const div = screen.getByTestId('div');

    expect(div.textContent).toBe('0');
    expect(selector.mock.calls.length).toBe(1);

    act(() => {
      store.set({ x: 0, y: 1 });
    });

    expect(div.textContent).toBe('0');
    expect(selector.mock.calls.length).toBe(1);

    act(() => {
      store.set({ x: 1, y: 1 });
    });

    expect(div.textContent).toBe('1');
    expect(selector.mock.calls.length).toBe(2);
  });

  test(`mapped store's selector is not evaluated unnecessarily`, () => {
    const store = createStore(0);
    const selector = vi.fn((x: number) => x + 1);
    const mappedStore = store.map(selector);

    const Component = function Component() {
      const v1 = useStore(mappedStore);
      const v2 = useStore(mappedStore);

      return (
        <div data-testid="div">
          {v1},{v2}
        </div>
      );
    };

    render(<Component />);
    const div = screen.getByTestId('div');

    expect(div.textContent).toBe('1,1');
    expect(selector.mock.calls.length).toBe(1);

    act(() => {
      store.set(1);
    });

    expect(div.textContent).toBe('2,2');
    expect(selector.mock.calls.length).toBe(2);
  });

  test(`mapped store is not subscribed to unnecessarily`, () => {
    let subscribedCount = 0;
    const store = createStore(0, {
      effect() {
        subscribedCount++;
      },
    });
    const mappedStore = store.map((x) => x + 1);

    const Component = function Component() {
      const value = useStore(mappedStore);

      return <div data-testid="div">{value}</div>;
    };

    render(<Component />);
    const div = screen.getByTestId('div');

    expect(div.textContent).toBe('1');
    expect(subscribedCount).toBe(1);

    act(() => {
      store.set(1);
    });

    expect(div.textContent).toBe('2');
    expect(subscribedCount).toBe(1);
  });

  test(`inline mapped store is not subscribed to unnecessarily`, () => {
    let subscribedCount = 0;
    const store = createStore(0, {
      effect() {
        subscribedCount++;
      },
    });

    const Component = function Component() {
      const value = useStore(store.map((x) => x + 1));

      return <div data-testid="div">{value}</div>;
    };

    render(<Component />);
    const div = screen.getByTestId('div');

    expect(div.textContent).toBe('1');
    expect(subscribedCount).toBe(1);

    act(() => {
      store.set(1);
    });

    expect(div.textContent).toBe('2');
    expect(subscribedCount).toBe(1);
  });
});
