import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Store, StoreScope } from '../../src/react';

beforeEach(() => {
  vi.useFakeTimers();
  performance.mark = () => undefined as any;
  performance.clearMarks = () => undefined;
});

afterEach(() => {
  vi.resetAllMocks();
});

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

test('two scopes', async () => {
  render(<Component id="div1" />);
  const div1 = screen.getByTestId('div1');
  const div1Child = screen.getByTestId('div1_child');

  render(<Component id="div2" />);
  const div2 = screen.getByTestId('div2');
  const div2Child = screen.getByTestId('div2_child');

  expect(div1.textContent).toBe('1');
  expect(div1Child.textContent).toBe('1');
  expect(div2.textContent).toBe('1');
  expect(div2Child.textContent).toBe('1');

  fireEvent.click(div1);
  act(() => {
    vi.runAllTimers();
  });
  expect(div1.textContent).toBe('2');
  expect(div1Child.textContent).toBe('2');
  expect(div2.textContent).toBe('1');
  expect(div2Child.textContent).toBe('1');
});

test('provided scopes', async () => {
  const store = new Store({ foo: 2 });
  render(
    <storeScope.Provider store={store}>
      <Simple />
    </storeScope.Provider>
  );

  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('2');
});
