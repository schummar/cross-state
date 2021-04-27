import { fireEvent, render, screen } from '@testing-library/react';
import test from 'ava';
import React, { useState } from 'react';
import { sleep } from '../src/misc';
import { Store } from '../src/react';

function Simple({ store, throttle }: { store: Store<{ foo: number }>; throttle?: number }) {
  const value = store.useState((s) => s.foo, undefined, { throttle });

  return <div data-testid="div">{value}</div>;
}

function Dynamic({ store }: { store: Store<{ foo: number; bar: number }> }) {
  const [key, setKey] = useState<'foo' | 'bar'>('foo');
  const value = store.useState((s) => s[key], [key]);

  const toggle = () => {
    setKey(key === 'foo' ? 'bar' : 'foo');
  };

  return (
    <div data-testid="div" onClick={toggle}>
      {key}: {value}
    </div>
  );
}

function NoSelector({ store, throttle }: { store: Store<{ foo?: number }>; throttle?: number }) {
  const value = store.useState(throttle ? { throttle } : undefined);

  return <div data-testid="div">{JSON.stringify(value)}</div>;
}

test.serial('simple', async (t) => {
  const store = new Store({ foo: 1 });

  render(<Simple store={store} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, '1');

  store.update((s) => {
    s.foo = 2;
  });
  await Promise.resolve();
  t.is(div.textContent, '2');
});

test.serial('dynamic selector', async (t) => {
  const store = new Store({ foo: 1, bar: 10 });

  render(<Dynamic store={store} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, 'foo: 1');

  fireEvent.click(div);
  await sleep(100);
  t.is(div.textContent, 'bar: 10');
});

test.serial('throttled', async (t) => {
  const store = new Store({ foo: 1 });

  render(<Simple store={store} throttle={100} />);
  const div = screen.getByTestId('div');

  store.update((s) => {
    s.foo++;
  });
  await Promise.resolve();
  t.is(div.textContent, '2');

  store.update((s) => {
    s.foo++;
  });
  await Promise.resolve();

  store.update((s) => {
    s.foo++;
  });
  await Promise.resolve();
  t.is(div.textContent, '2');

  await sleep(100);
  t.is(div.textContent, '4');
});

test.serial('no selector', async (t) => {
  const store = new Store({ foo: 1 });

  render(<NoSelector store={store} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, '{"foo":1}');

  store.update((s) => {
    s.foo = 2;
  });
  await Promise.resolve();
  t.is(div.textContent, '{"foo":2}');
});

test.serial('no selector throttled', async (t) => {
  const store = new Store({ foo: 1 });

  render(<NoSelector store={store} throttle={100} />);
  const div = screen.getByTestId('div');

  store.update((s) => {
    s.foo++;
  });
  await Promise.resolve();
  t.is(div.textContent, '{"foo":2}');

  store.update((s) => {
    s.foo++;
  });
  await Promise.resolve();

  store.update((s) => {
    s.foo++;
  });
  await Promise.resolve();
  t.is(div.textContent, '{"foo":2}');

  await sleep(100);
  t.is(div.textContent, '{"foo":4}');
});
