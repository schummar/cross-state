import { fireEvent, render, screen } from '@testing-library/react';
import test from 'ava';
import React from 'react';
import { Store, StoreScope } from '../../src/react';

const storeScope = new StoreScope({ foo: 1 });

function ChildComponent({ id }: { id: string }) {
  const value = storeScope.useState('foo');

  return <div data-testid={`${id}_child`}>{value}</div>;
}

const Component = storeScope.withScope(function Simple({ id }: { id: string }) {
  const [value, update] = storeScope.useProp('foo');

  return (
    <div>
      <div data-testid={id} onClick={() => update(value + 1)}>
        {value}
      </div>

      <ChildComponent id={id} />
    </div>
  );
});

function Simple() {
  const value = storeScope.useState('foo');
  return <div data-testid="div">{value}</div>;
}

test.serial('two scopes', async (t) => {
  render(<Component id="div1" />);
  const div1 = screen.getByTestId('div1');
  const div1Child = screen.getByTestId('div1_child');

  render(<Component id="div2" />);
  const div2 = screen.getByTestId('div2');
  const div2Child = screen.getByTestId('div2_child');

  t.is(div1.textContent, '1');
  t.is(div1Child.textContent, '1');
  t.is(div2.textContent, '1');
  t.is(div2Child.textContent, '1');

  fireEvent.click(div1);
  await Promise.resolve();
  t.is(div1.textContent, '2');
  t.is(div1Child.textContent, '2');
  t.is(div2.textContent, '1');
  t.is(div2Child.textContent, '1');
});

test.serial('provided scopes', async (t) => {
  const store = new Store({ foo: 2 });
  render(
    <storeScope.Provider store={store}>
      <Simple />
    </storeScope.Provider>
  );

  const div = screen.getByTestId('div');
  t.is(div.textContent, '2');
});
