import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createCache, createPagedCache } from '../../src';
import { useCache } from '../../src/react';
import { flushPromises, sleep } from '../testHelpers';

afterEach(() => {
  vi.useRealTimers();
});

describe('useCache', () => {
  test('value', async () => {
    const cache = createCache(async () => 1);

    const Component = vi.fn(function Component() {
      const [value] = useCache(cache);

      return <div data-testid="div">{value}</div>;
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    expect(div.textContent).toBe('');

    await act(() => flushPromises());

    expect(div.textContent).toBe('1');
  });

  test('error', async () => {
    const cache = createCache(async () => {
      throw new Error('error');
    });

    const Component = vi.fn(function Component() {
      const [, error] = useCache(cache);

      return <div data-testid="div">{error instanceof Error ? error.message : ''}</div>;
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    expect(div.textContent).toBe('');

    await act(() => flushPromises());

    expect(div.textContent).toBe('error');
  });

  test('isUpdating', async () => {
    const cache = createCache(async () => 1);

    const Component = vi.fn(function Component() {
      const isUpdating = useCache(cache)[2];

      return <div data-testid="div">{isUpdating ? 'true' : 'false'}</div>;
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    expect(div.textContent).toBe('true');

    await act(() => flushPromises());

    expect(div.textContent).toBe('false');
  });

  test('isStale', async () => {
    const cache = createCache(async () => 1);

    const Component = vi.fn(function Component() {
      const isStale = useCache(cache)[3];

      return <div data-testid="div">{isStale ? 'true' : 'false'}</div>;
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    expect(div.textContent).toBe('true');

    await act(() => flushPromises());

    expect(div.textContent).toBe('false');
  });

  test('access via keys', async () => {
    const cache = createCache(async () => 1);

    const Component = vi.fn(function Component() {
      const { value, error, isUpdating, isStale } = useCache(cache);

      return <div data-testid="div">{JSON.stringify({ value, error, isUpdating, isStale })}</div>;
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    expect(div.textContent).toBe('{"isUpdating":true,"isStale":true}');

    await act(() => flushPromises());

    expect(div.textContent).toBe('{"value":1,"isUpdating":false,"isStale":false}');
  });

  test('with updateValue', async () => {
    const cache = createCache(async (_key: unknown) => 1);

    const Component = vi.fn(function Component() {
      const [value] = useCache(cache({ a: 'a', b: 0, c: new Date(0) }));

      return (
        <div
          data-testid="div"
          onClick={() => cache({ a: 'a', b: 0, c: new Date(0) }).updateValue(2)}
        >
          {value}
        </div>
      );
    });

    render(<Component />);
    const div = screen.getByTestId('div');

    await act(() => cache({ a: 'a', b: 0, c: new Date(0) }).get());
    expect(div.textContent).toBe('1');

    await act(async () => {
      div.click();
      await flushPromises();
    });

    expect(div.textContent).toBe('2');
  });

  describe('passive', () => {
    test(`doesn't trigger getter`, async () => {
      const getter = vi.fn(async () => 1);
      const cache = createCache(getter);

      const Component = vi.fn(function Component() {
        const state = useCache(cache, { passive: true });

        return <div data-testid="div">{JSON.stringify(state)}</div>;
      });

      render(<Component />);
      const div = screen.getByTestId('div');

      await act(() => flushPromises());

      expect(div.textContent).toBe('[null,null,false,true]');
      expect(getter).not.toHaveBeenCalled();
    });

    test(`shows updated values if triggered somewhere else`, async () => {
      const cache = createCache(async () => 1);

      const Component = vi.fn(function Component() {
        const state = useCache(cache, { passive: true });

        return <div data-testid="div">{JSON.stringify(state)}</div>;
      });

      render(<Component />);
      const div = screen.getByTestId('div');

      await act(async () => {
        await cache.get();
        await flushPromises();
      });

      expect(div.textContent).toBe('[1,null,false,false]');
    });
  });

  describe('mapValue', () => {
    test('simple', async () => {
      const cache = createCache(async () => 1);

      const Component = vi.fn(function Component() {
        const [value] = useCache(cache.mapValue((value) => value + 1));

        return <div data-testid="div">{value}</div>;
      });

      render(<Component />);
      const div = screen.getByTestId('div');

      expect(div.textContent).toBe('');

      await act(() => flushPromises());

      expect(div.textContent).toBe('2');
    });

    test('mapValue throws', async () => {
      const cache = createCache(async () => 1);

      const Component = vi.fn(function Component() {
        const [, error] = useCache(
          cache.mapValue(() => {
            throw Error('mapValue throws');
          }),
        );

        return <div data-testid="div">{error instanceof Error ? error.message : null}</div>;
      });

      render(<Component />);
      const div = screen.getByTestId('div');

      await act(() => flushPromises(2));
      expect(div.textContent).toBe('mapValue throws');
    });

    describe('with args', () => {
      test('with args', async () => {
        const cache = createCache(async (x: number) => `x=${x}`);

        const Component = vi.fn(function Component() {
          const [value] = useCache(cache(1));

          return <div data-testid="div">{value}</div>;
        });

        render(<Component />);
        const div = screen.getByTestId('div');

        expect(div.textContent).toBe('');

        await act(() => flushPromises());

        expect(div.textContent).toBe('x=1');
      });

      test('change args', async () => {
        const cache = createCache(async (x: number) => `x=${x}`);

        const Component = vi.fn(function Component() {
          const [key, setKey] = useState(1);
          const [value] = useCache(cache(key));

          return (
            <div data-testid="div" onClick={() => setKey(2)}>
              {value}
            </div>
          );
        });

        render(<Component />);
        const div = screen.getByTestId('div');

        expect(div.textContent).toBe('');

        await act(() => flushPromises());

        expect(div.textContent).toBe('x=1');

        await act(async () => {
          div.click();
          await flushPromises();
        });

        expect(div.textContent).toBe('x=2');
      });
    });
  });

  describe('with paged cache', () => {
    test('pages are loaded', async () => {
      vi.useFakeTimers();

      const cache = createPagedCache<number>({
        fetchPage: async ({ pages }) => {
          await sleep(1);
          return pages.length;
        },
      });

      const Component = vi.fn(function Component() {
        const [value, , isUpdating] = useCache(cache);

        return (
          <div data-testid="div">
            {JSON.stringify(value)}
            {isUpdating ? 'loading' : null}
          </div>
        );
      });

      render(<Component />);
      const div = screen.getByTestId('div');

      expect(div.textContent).toBe('loading');

      await act(async () => await vi.advanceTimersByTimeAsync(1));

      expect(div.textContent).toBe('{"pages":[0],"hasMore":true,"pageCount":null}');

      await act(async () => {
        cache.fetchNextPage();
      });

      expect(div.textContent).toBe('{"pages":[0],"hasMore":true,"pageCount":null}loading');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(div.textContent).toBe('{"pages":[0,1],"hasMore":true,"pageCount":null}');

      await act(async () => {
        cache.fetchNextPage();
      });

      expect(div.textContent).toBe('{"pages":[0,1],"hasMore":true,"pageCount":null}loading');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(div.textContent).toBe('{"pages":[0,1,2],"hasMore":true,"pageCount":null}');
    });
  });
});
