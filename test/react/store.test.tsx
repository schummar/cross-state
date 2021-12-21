/**
 * @jest-environment jsdom
 */

import { afterEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React, { ReactNode, useEffect, useState } from 'react';
import { Store } from '../../src/react';
import './_setup';

jest.useFakeTimers();

afterEach(() => {
  jest.runAllTimers();
});

function Simple({ useValue }: { useValue: () => ReactNode }) {
  const value = useValue();

  return <div data-testid="div">{value}</div>;
}

function Dynamic({ store }: { store: Store<{ foo: number; bar: number }> }) {
  const [key, setKey] = useState<'foo' | 'bar'>('foo');
  const value = store.useState((s) => s[key]);

  const toggle = () => {
    setKey(key === 'foo' ? 'bar' : 'foo');
  };

  return (
    <div data-testid="div" onClick={toggle}>
      {key}: {value}
    </div>
  );
}

function WithProp({ useProp }: { useProp: () => [value: number, update: (value: number) => void] }) {
  const [value, update] = useProp();

  return (
    <div data-testid="div" onClick={() => update(value + 1)}>
      {value}
    </div>
  );
}

function NoSelector({ store, throttle }: { store: Store<{ foo: number }>; throttle?: number }) {
  const value = store.useState(throttle ? { throttle } : undefined);

  return <div data-testid="div">{JSON.stringify(value)}</div>;
}

test('simple', async () => {
  const store = new Store({ foo: 1 });

  render(<Simple useValue={() => store.useState((state) => state.foo)} />);
  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('1');

  act(() =>
    store.update((s) => {
      s.foo = 2;
    })
  );
  expect(div.textContent).toBe('2');
});

test('dynamic selector', async () => {
  const store = new Store({ foo: 1, bar: 10 });

  render(<Dynamic store={store} />);
  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('foo: 1');

  fireEvent.click(div);
  expect(div.textContent).toBe('bar: 10');
});

test('string selector', async () => {
  const store = new Store({ foo: 1 });

  render(<Simple useValue={() => store.useState('foo')} />);
  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('1');

  act(() =>
    store.update((s) => {
      s.foo = 2;
    })
  );
  expect(div.textContent).toBe('2');
});

test('prop error undefined', async () => {
  expect.assertions(2);
  const store = new Store({ foo: 1 });

  render(
    <WithProp
      useProp={() => {
        const [value, update] = store.useProp('bar.baz' as any);
        return [value, (v: any) => expect(() => update(v)).toThrow()];
      }}
    />
  );
  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('');
  fireEvent.click(div);
});

test('prop error wrong type', async () => {
  expect.assertions(2);
  const store = new Store({ foo: 1 });

  render(
    <WithProp
      useProp={() => {
        const [value, update] = store.useProp('foo.baz' as any);
        return [value, (v: any) => expect(() => update(v)).toThrow()];
      }}
    />
  );
  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('');
  fireEvent.click(div);
});

test('prop', async () => {
  const store = new Store({ foo: 1 });

  render(<WithProp useProp={() => store.useProp('foo')} />);
  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('1');

  act(() =>
    store.update((s) => {
      s.foo = 2;
    })
  );
  expect(div.textContent).toBe('2');

  fireEvent.click(div);
  expect(div.textContent).toBe('3');
});

test('throttled', async () => {
  const store = new Store({ foo: 1 });

  render(<Simple useValue={() => store.useState((state) => state.foo, { throttle: 100 })} />);
  const div = screen.getByTestId('div');

  act(() =>
    store.update((s) => {
      s.foo++;
    })
  );
  expect(div.textContent).toBe('2');

  store.update((s) => {
    s.foo++;
  });
  act(() => jest.advanceTimersByTime(50));

  store.update((s) => {
    s.foo++;
  });
  act(() => jest.advanceTimersByTime(49));
  expect(div.textContent).toBe('2');

  act(() => jest.advanceTimersByTime(1));
  expect(div.textContent).toBe('4');
});

test('throttled string selector', async () => {
  const store = new Store({ foo: 1 });

  render(<Simple useValue={() => store.useState('foo', { throttle: 100 })} />);
  const div = screen.getByTestId('div');

  act(() =>
    store.update((s) => {
      s.foo++;
    })
  );
  expect(div.textContent).toBe('2');

  store.update((s) => {
    s.foo++;
  });
  act(() => jest.advanceTimersByTime(50));

  store.update((s) => {
    s.foo++;
  });
  act(() => jest.advanceTimersByTime(49));
  expect(div.textContent).toBe('2');

  act(() => jest.advanceTimersByTime(1));
  expect(div.textContent).toBe('4');
});

test('no selector', async () => {
  const store = new Store({ foo: 1 });

  render(<NoSelector store={store} />);
  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('{"foo":1}');

  act(() =>
    store.update((s) => {
      s.foo = 2;
    })
  );
  expect(div.textContent).toBe('{"foo":2}');
});

test('no selector throttled', async () => {
  const store = new Store({ foo: 1 });

  render(<NoSelector store={store} throttle={100} />);
  const div = screen.getByTestId('div');

  act(() =>
    store.update((s) => {
      s.foo++;
    })
  );
  expect(div.textContent).toBe('{"foo":2}');

  store.update((s) => {
    s.foo++;
  });
  act(() => jest.advanceTimersByTime(50));

  store.update((s) => {
    s.foo++;
  });
  act(() => jest.advanceTimersByTime(49));
  expect(div.textContent).toBe('{"foo":2}');

  act(() => jest.advanceTimersByTime(1));
  expect(div.textContent).toBe('{"foo":4}');
});

test('addReaction', async () => {
  const store = new Store({ foo: 0 });

  render(<Simple useValue={() => store.useState((s) => s.foo * 2)} />);
  const div = screen.getByTestId('div');

  store.addReaction(
    (s) => s.foo,
    (foo, state) => {
      if (foo % 2 === 1) state.foo++;
    }
  );

  act(() =>
    store.update((s) => {
      s.foo++;
    })
  );

  expect(div.textContent).toBe('4');
});

test('useStoreState with change before useEffect kicks in', async () => {
  const store = new Store({ foo: 0 });

  function X() {
    useEffect(() => {
      store.update((state) => {
        state.foo++;
      });
    }, []);

    const value = store.useState('foo');

    return <div data-testid="div">{value}</div>;
  }

  render(<X />);
  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('1');
});
