/**
 * @jest-environment jsdom
 */

import { afterEach, expect, jest, test } from '@jest/globals';
import { act, render, screen } from '@testing-library/react';
import React, { useEffect } from 'react';
import { createResource, ResourceInfo } from '../../src';
import { combineResources, useResource } from '../../src/react';
import { sleep } from '../_helpers';
import './_setup';

jest.useFakeTimers();

afterEach(() => {
  jest.runAllTimers();
});

const tick = () => act(async () => undefined);

function Component({ useResource }: { useResource: () => ResourceInfo<unknown> }) {
  const { value, error, isLoading } = useResource();
  const string = value instanceof Object ? JSON.stringify(value) : value;

  return (
    <div data-testid="div">
      v:{string} l:{JSON.stringify(isLoading)} e:{error}
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
  expect(div.textContent).toBe('v:2 l:false e:');
});

test('clear', async () => {
  let executed = 0;
  const resource = createResource(async (x: number) => {
    await sleep(1);
    executed++;
    return x + executed;
  });

  render(<Component useResource={() => useResource(resource(1))} />);
  const div = screen.getByTestId('div');

  act(() => jest.advanceTimersByTime(1));
  await tick();
  expect(div.textContent).toBe('v:2 l:false e:');

  act(() => resource(1).clearCache());
  await tick();
  expect(div.textContent).toBe('v: l:true e:');

  act(() => jest.advanceTimersByTime(1));
  await tick();
  expect(div.textContent).toBe('v:3 l:false e:');
  expect(executed).toBe(2);
});

test('invalidate', async () => {
  let executed = 0;
  const resource = createResource(async (x: number) => {
    await sleep(1);
    executed++;
    return x + executed;
  });

  render(<Component useResource={() => useResource(resource(1))} />);
  const div = screen.getByTestId('div');

  act(() => jest.advanceTimersByTime(1));
  await tick();
  expect(div.textContent).toBe('v:2 l:false e:');

  act(() => resource(1).invalidateCache());
  await tick();
  expect(div.textContent).toBe('v:2 l:true e:');

  act(() => jest.advanceTimersByTime(1));
  await tick();
  expect(div.textContent).toBe('v:3 l:false e:');
  expect(executed).toBe(2);
});

test('invalidateAfter', async () => {
  let executed = 0;
  const resource = createResource(
    async () => {
      await sleep(1);
      return executed++;
    },
    { invalidateAfter: 2 }
  );

  render(<Component useResource={() => useResource(resource())} />);
  const div = screen.getByTestId('div');

  act(() => jest.advanceTimersByTime(2));
  await tick();
  expect(div.textContent).toBe('v:0 l:false e:');

  act(() => jest.advanceTimersByTime(2));
  await tick();
  expect(div.textContent).toBe('v:0 l:true e:');

  act(() => jest.advanceTimersByTime(1));
  await tick();
  expect(div.textContent).toBe('v:1 l:false e:');

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
  await act(async () => {
    await resource(1).get();
  });

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

  await act(async () => {
    await resource(1).get();
  });
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

test('manual clear after mount', async () => {
  const resource = createResource(async () => {
    return 1;
  });

  function Component({ useResource }: { useResource: () => ResourceInfo<unknown> }) {
    const { value, error, isLoading } = useResource();

    useEffect(() => resource.clearCacheAll(), []);

    return (
      <div data-testid="div">
        v:{value} l:{JSON.stringify(isLoading)} e:{error}
      </div>
    );
  }

  render(<Component useResource={() => useResource(resource())} />);
  const div = screen.getByTestId('div');
  expect(div.textContent).toBe('v: l:false e:');

  act(() => jest.runAllTimers());
  await tick();
  act(() => jest.runAllTimers());
  expect(div.textContent).toBe('v:1 l:false e:');
});

test('useCombinedResources', async () => {
  const resource = createResource(async (x: number) => {
    await sleep(x);
    return x;
  });

  render(
    <Component
      useResource={() =>
        useResource(
          combineResources(
            //
            resource(1),
            resource(2),
            resource(3)
          ),
          { updateOnMount: true }
        )
      }
    />
  );
  const div = screen.getByTestId('div');

  act(() => jest.advanceTimersByTime(2));
  await tick();
  expect(div.textContent).toBe('v: l:true e:');

  act(() => jest.advanceTimersByTime(1));
  await tick();
  expect(div.textContent).toBe('v:[1,2,3] l:false e:');
});

test('useCombinedResources with error', async () => {
  const r1 = createResource(async () => {
    return 1;
  });
  const r2 = createResource(async () => {
    throw 'error';
  });

  render(
    <Component
      useResource={() =>
        useResource(
          combineResources(
            //
            r1(),
            r2()
          )
        )
      }
    />
  );
  const div = screen.getByTestId('div');

  await tick();
  expect(div.textContent).toBe('v: l:false e:error');
});
