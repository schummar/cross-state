import { fireEvent, render, screen } from '@testing-library/react';
import test from 'ava';
import React, { ReactNode, useEffect, useState } from 'react';
import { sleep } from '../../src/helpers/misc';
import { Store } from '../../src/react';
import { UseStorePropResult } from '../../src/react/useStoreProp';

function Simple({ useValue }: { useValue: () => ReactNode }) {
  const value = useValue();

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

test.serial('simple', async (t) => {
  const store = new Store({ foo: 1 });

  render(<Simple useValue={() => store.useState((state) => state.foo)} />);
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
  t.is(div.textContent, 'bar: 10');
});

test.serial('string selector', async (t) => {
  const store = new Store({ foo: 1 });

  render(<Simple useValue={() => store.useState('foo')} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, '1');

  store.update((s) => {
    s.foo = 2;
  });
  await Promise.resolve();
  t.is(div.textContent, '2');
});

test.serial('prop error undefined', async (t) => {
  t.plan(2);
  const store = new Store({ foo: 1 });

  render(
    <WithProp
      useProp={() => {
        const [value, update] = store.useProp('bar.baz' as any);
        return [value, (v: any) => t.throws(() => update(v))];
      }}
    />
  );
  const div = screen.getByTestId('div');
  t.is(div.textContent, '');
  fireEvent.click(div);
});

test.serial('prop error wrong type', async (t) => {
  t.plan(2);
  const store = new Store({ foo: 1 });

  render(
    <WithProp
      useProp={() => {
        const [value, update] = store.useProp('foo.baz' as any);
        return [value, (v: any) => t.throws(() => update(v))];
      }}
    />
  );
  const div = screen.getByTestId('div');
  t.is(div.textContent, '');
  fireEvent.click(div);
});

test.serial('prop', async (t) => {
  const store = new Store({ foo: 1 });

  render(<WithProp useProp={() => store.useProp('foo')} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, '1');

  store.update((s) => {
    s.foo = 2;
  });
  await Promise.resolve();
  t.is(div.textContent, '2');

  fireEvent.click(div);
  await Promise.resolve();
  t.is(div.textContent, '3');
});

test.serial('throttled', async (t) => {
  const store = new Store({ foo: 1 });

  render(<Simple useValue={() => store.useState((state) => state.foo, undefined, { throttle: 100 })} />);
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

  await sleep(125);
  t.is(div.textContent, '4');
});

test.serial('throttled string selector', async (t) => {
  const store = new Store({ foo: 1 });

  render(<Simple useValue={() => store.useState('foo', { throttle: 100 })} />);
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

  await sleep(125);
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

  await sleep(125);
  t.is(div.textContent, '{"foo":4}');
});

test.serial('addReaction', async (t) => {
  const store = new Store({ foo: 0 });

  render(<Simple useValue={() => store.useState((s) => s.foo * 2)} />);
  const div = screen.getByTestId('div');

  store.addReaction(
    (s) => s.foo,
    (foo, state) => {
      if (foo % 2 === 1) state.foo++;
    }
  );
  store.update((s) => {
    s.foo++;
  });

  await Promise.resolve();
  t.is(div.textContent, '4');
});

test.serial('useStoreState with change before useEffect kicks in', async (t) => {
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
  t.is(div.textContent, '1');
});
