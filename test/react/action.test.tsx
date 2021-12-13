import { render, screen } from '@testing-library/react';
import test from 'ava';
import React from 'react';
import { Action, ActionState } from '../../src';
import { sleep } from '../../src/helpers/misc';
import { useAction } from '../../src/react';
import { wait } from '../_helpers';
import './_setup';

function Component({ useAction }: { useAction: () => ActionState<unknown> }) {
  const { value, error, isLoading } = useAction();

  return (
    <div data-testid="div">
      v:{value} l:{JSON.stringify(isLoading)} e:{error}
    </div>
  );
}

test.serial('simple', async (t) => {
  const action = Action.create(async (x: number) => {
    await wait(0);
    return x * 2;
  });

  render(<Component useAction={() => useAction(action(1))} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, 'v: l:true e:');

  await wait(1);
  t.is(div.textContent, 'v:2 l:false e:');
});

test.serial('clear', async (t) => {
  let executed = 0;
  const action = Action.create(async (x: number) => {
    executed++;
    await wait(1);
    return x + executed;
  });

  render(<Component useAction={() => useAction(action(1))} />);
  const div = screen.getByTestId('div');

  await wait(1);
  t.is(div.textContent, 'v:2 l:false e:');

  action(1).clearCache();
  await wait(1);
  t.is(div.textContent, 'v: l:true e:');

  await wait(1);
  t.is(div.textContent, 'v:3 l:false e:');

  t.is(executed, 2);
});

test.serial('invalidate', async (t) => {
  let executed = 0;
  const action = Action.create(async (x: number) => {
    executed++;
    await wait(1);
    return x + executed;
  });

  render(<Component useAction={() => useAction(action(1))} />);
  const div = screen.getByTestId('div');

  await wait(1);
  t.is(div.textContent, 'v:2 l:false e:');

  action(1).invalidateCache();
  await wait(1);
  t.is(div.textContent, 'v:2 l:true e:');

  await wait(1);
  t.is(div.textContent, 'v:3 l:false e:');

  t.is(executed, 2);
});

test.serial('invalidateAfter', async (t) => {
  let executed = 0;
  const action = Action.create(
    async (x: number) => {
      executed++;
      await sleep(100);
      return x + executed;
    },
    { invalidateAfter: 100 }
  );

  render(<Component useAction={() => useAction(action(1))} />);
  const div = screen.getByTestId('div');

  await sleep(150);
  t.is(div.textContent, 'v:2 l:false e:');

  await sleep(100);
  t.is(div.textContent, 'v:2 l:true e:');

  await sleep(100);
  t.is(div.textContent, 'v:3 l:false e:');

  t.is(executed, 2);
});

test.serial('dormant', async (t) => {
  let executed = 0;
  const action = Action.create(async (x: number) => {
    executed++;
    await wait(0);
    return x * 2;
  });

  render(<Component useAction={() => useAction(action(1), { dormant: true })} />);
  const div = screen.getByTestId('div');

  await wait(10);
  t.is(div.textContent, 'v: l:false e:');
  t.is(executed, 0);
});

test.serial('updateOnMount', async (t) => {
  let executed = 0;
  const action = Action.create(async (x: number) => {
    executed++;
    await wait(0);
    return x * 2;
  });
  await action(1).execute();

  render(<Component useAction={() => useAction(action(1), { updateOnMount: true })} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, 'v:2 l:true e:');

  await wait(1);
  t.is(div.textContent, 'v:2 l:false e:');
  t.is(executed, 2);
});

test.serial('updateOnMount not double', async (t) => {
  let executed = 0;
  const action = Action.create(async (x: number) => {
    executed++;
    await wait(0);
    return x * 2;
  });

  render(<Component useAction={() => useAction(action(1), { updateOnMount: true })} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, 'v: l:true e:');

  await wait(1);
  t.is(div.textContent, 'v:2 l:false e:');
  t.is(executed, 1);
});

test.serial('watchOnly', async (t) => {
  let executed = 0;
  const action = Action.create(async (x: number) => {
    executed++;
    await wait(0);
    return x * 2;
  });

  render(<Component useAction={() => useAction(action(1), { watchOnly: true })} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, 'v: l:false e:');

  await wait(0);
  t.is(div.textContent, 'v: l:false e:');

  await action(1).execute();
  t.is(div.textContent, 'v:2 l:false e:');
  t.is(executed, 1);
});

test.serial('throttle', async (t) => {
  let executed = 0;
  const action = Action.create(async (x: number) => {
    executed++;
    await wait(5);
    return x + executed;
  });

  render(<Component useAction={() => useAction(action(1), { throttle: 100 })} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, 'v: l:true e:');

  await sleep(50);
  t.is(div.textContent, 'v: l:true e:');

  await sleep(150);
  t.is(div.textContent, 'v:2 l:false e:');

  t.is(executed, 1);
});

test.serial('error', async (t) => {
  const action = Action.create<number, number>(async () => {
    await wait(0);
    throw 'error';
  });

  render(<Component useAction={() => useAction(action(1))} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, 'v: l:true e:');

  await wait(1);
  t.is(div.textContent, 'v: l:false e:error');
});

test.serial('complex key', async (t) => {
  let executed = 0;
  const action = Action.create(
    async (key: { foo: string }) => {
      executed++;
      await wait(0);
      return key.foo + executed;
    },
    { invalidateAfter: 10 }
  );

  render(<Component useAction={() => useAction(action({ foo: 'bar' }))} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, 'v: l:true e:');

  await wait(1);
  t.is(div.textContent, 'v:bar1 l:false e:');

  await sleep(15);
  t.is(div.textContent, 'v:bar2 l:false e:');
  t.is(executed, 2);
});
