/**
 * @jest-environment jsdom
 */

import { afterEach, expect, jest, test } from '@jest/globals';
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { createResource, ResourceState } from '../../src';
import { sleep } from '../../src/helpers/misc';
import { useResource } from '../../src/react';
import './_setup';

jest.useFakeTimers();

afterEach(() => {
  jest.runAllTimers();
});

const tick = () => act(async () => null);

function Component({ useResource }: { useResource: () => ResourceState<unknown> }) {
  const { value, error, isLoading } = useResource();

  return (
    <div data-testid="div">
      v:{value} l:{JSON.stringify(isLoading)} e:{error}
    </div>
  );
}

test('simple', async () => {
  const resource = createResource(async (x: number) => {
    return x * 2;
  });

  render(<Component useResource={() => useResource(resource(1))} />);
  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('v: l:true e:');

  await tick();
  act(() => jest.runAllTimers());
  expect(div.textContent).toBe('v:2 l:false e:');
});

test('clear', async () => {
  let executed = 0;
  const resource = createResource(async (x: number) => {
    executed++;
    return x + executed;
  });

  render(<Component useResource={() => useResource(resource(1))} />);
  const div = screen.getByTestId('div');

  await tick();
  act(() => jest.runAllTimers());
  expect(div.textContent).toBe('v:2 l:false e:');

  resource(1).clearCache();
  await tick();
  act(() => jest.runAllTimers());
  expect(div.textContent).toBe('v: l:true e:');

  await tick();
  act(() => jest.runAllTimers());
  expect(div.textContent).toBe('v:3 l:false e:');

  expect(executed).toBe(2);
});

test('invalidate', async () => {
  let executed = 0;
  const resource = createResource(async (x: number) => {
    executed++;
    return x + executed;
  });

  render(<Component useResource={() => useResource(resource(1))} />);
  const div = screen.getByTestId('div');

  await tick();
  act(() => jest.runAllTimers());
  expect(div.textContent).toBe('v:2 l:false e:');

  resource(1).invalidateCache();
  await tick();
  act(() => jest.runAllTimers());
  expect(div.textContent).toBe('v:2 l:true e:');

  await tick();
  act(() => jest.runAllTimers());
  expect(div.textContent).toBe('v:3 l:false e:');

  expect(executed).toBe(2);
});

test('invalidateAfter', async () => {
  let executed = 0;
  const resource = createResource(
    async (x: number) => {
      executed++;
      return x + executed;
    },
    { invalidateAfter: 2 }
  );

  render(<Component useResource={() => useResource(resource(1))} />);
  const div = screen.getByTestId('div');

  await tick();
  act(() => jest.advanceTimersByTime(1));
  expect(div.textContent).toBe('v:2 l:false e:');

  await tick();
  act(() => jest.advanceTimersByTime(2));
  expect(div.textContent).toBe('v:2 l:true e:');

  await tick();
  act(() => jest.advanceTimersByTime(1));
  expect(div.textContent).toBe('v:3 l:false e:');

  expect(executed).toBe(2);
});

test('dormant', async () => {
  let executed = 0;
  const resource = createResource(async (x: number) => {
    executed++;
    return x * 2;
  });

  render(<Component useResource={() => useResource(resource(1), { dormant: true })} />);
  const div = screen.getByTestId('div');

  await tick();
  act(() => jest.runAllTimers());
  expect(div.textContent).toBe('v: l:false e:');
  expect(executed).toBe(0);
});

test('updateOnMount', async () => {
  let executed = 0;
  const resource = createResource(async (x: number) => {
    executed++;
    return x * 2;
  });
  await resource(1).get();

  render(<Component useResource={() => useResource(resource(1), { updateOnMount: true })} />);
  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('v:2 l:true e:');

  await tick();
  act(() => jest.runAllTimers());
  expect(div.textContent).toBe('v:2 l:false e:');
  expect(executed).toBe(2);
});

test('updateOnMount not double', async () => {
  let executed = 0;
  const resource = createResource(async (x: number) => {
    executed++;
    return x * 2;
  });

  render(<Component useResource={() => useResource(resource(1), { updateOnMount: true })} />);
  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('v: l:true e:');

  await tick();
  act(() => jest.runAllTimers());
  expect(div.textContent).toBe('v:2 l:false e:');
  expect(executed).toBe(1);
});

test('watchOnly', async () => {
  let executed = 0;
  const resource = createResource(async (x: number) => {
    executed++;
    return x * 2;
  });

  render(<Component useResource={() => useResource(resource(1), { watchOnly: true })} />);
  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('v: l:false e:');

  await tick();
  act(() => jest.runAllTimers());
  expect(div.textContent).toBe('v: l:false e:');

  await resource(1).get();
  await tick();
  act(() => jest.runAllTimers());
  expect(div.textContent).toBe('v:2 l:false e:');
  expect(executed).toBe(1);
});

test('throttle', async () => {
  let executed = 0;
  const resource = createResource(async (x: number) => {
    executed++;
    await sleep(1);
    return x + executed;
  });

  render(<Component useResource={() => useResource(resource(1), { throttle: 2 })} />);
  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('v: l:true e:');

  await tick();
  act(() => jest.advanceTimersByTime(1));
  expect(div.textContent).toBe('v: l:true e:');

  await tick();
  act(() => jest.advanceTimersByTime(1));
  expect(div.textContent).toBe('v:2 l:false e:');

  expect(executed).toBe(1);
});

test('error', async () => {
  const resource = createResource<number, number>(async () => {
    throw 'error';
  });

  render(<Component useResource={() => useResource(resource(1))} />);
  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('v: l:true e:');

  await tick();
  act(() => jest.runAllTimers());
  expect(div.textContent).toBe('v: l:false e:error');
});

test('complex key', async () => {
  const resource = createResource(async (key: { foo: string }) => {
    return key.foo;
  });

  render(<Component useResource={() => useResource(resource({ foo: 'bar' }))} />);
  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('v: l:true e:');

  await tick();
  act(() => jest.runAllTimers());
  expect(div.textContent).toBe('v:bar l:false e:');
});
