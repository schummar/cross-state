import { render, screen } from '@testing-library/react';
import test from 'ava';
import React from 'react';
import { sleep } from '../src/misc';
import { Action, UseActionOptions } from '../src/react';

function Component({ useAction }: { useAction: () => [unknown, { isLoading: boolean; error?: unknown }] }) {
  const [value, { isLoading, error }] = useAction();

  return (
    <div data-testid="div">
      v:{value} l:{JSON.stringify(isLoading)} e:{error}
    </div>
  );
}

test.serial('simple', async (t) => {
  const action = new Action(async (x: number) => {
    await sleep(0);
    return x * 2;
  });

  render(<Component useAction={() => action.useAction(1)} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, 'v: l:true e:');

  await sleep(0);
  t.is(div.textContent, 'v:2 l:false e:');
});

test.serial('clear', async (t) => {
  let executed = 0;
  const action = new Action(async (x: number) => {
    executed++;
    await sleep(0);
    return x + executed;
  });

  render(<Component useAction={() => action.useAction(1)} />);
  const div = screen.getByTestId('div');

  await sleep(0);
  t.is(div.textContent, 'v:2 l:false e:');

  action.clearCache(1);
  await sleep(0);
  t.is(div.textContent, 'v: l:true e:');

  await sleep(0);
  t.is(div.textContent, 'v:3 l:false e:');

  t.is(executed, 2);
});

test.serial('invalidate', async (t) => {
  let executed = 0;
  const action = new Action(async (x: number) => {
    executed++;
    await sleep(0);
    return x + executed;
  });

  render(<Component useAction={() => action.useAction(1)} />);
  const div = screen.getByTestId('div');

  await sleep(0);
  t.is(div.textContent, 'v:2 l:false e:');

  action.invalidateCache(1);
  await sleep(0);
  t.is(div.textContent, 'v:2 l:true e:');

  await sleep(0);
  t.is(div.textContent, 'v:3 l:false e:');

  t.is(executed, 2);
});

test.serial('invalidateAfter', async (t) => {
  let executed = 0;
  const action = new Action(
    async (x: number) => {
      executed++;
      await sleep(10);
      return x + executed;
    },
    { invalidateAfter: 10 }
  );

  render(<Component useAction={() => action.useAction(1)} />);
  const div = screen.getByTestId('div');

  await sleep(15);
  t.is(div.textContent, 'v:2 l:false e:');

  await sleep(10);
  t.is(div.textContent, 'v:2 l:true e:');

  await sleep(10);
  t.is(div.textContent, 'v:3 l:false e:');

  t.is(executed, 2);
});

test.serial('dormant', async (t) => {
  let executed = 0;
  const action = new Action(async (x: number) => {
    executed++;
    await sleep(0);
    return x * 2;
  });

  render(<Component useAction={() => action.useAction(1, { dormant: true })} />);
  const div = screen.getByTestId('div');

  await sleep(10);
  t.is(div.textContent, 'v: l:false e:');
  t.is(executed, 0);
});

test.serial('updateOnMount', async (t) => {
  let executed = 0;
  const action = new Action(async (x: number) => {
    executed++;
    await sleep(0);
    return x * 2;
  });
  await action.execute(1);

  render(<Component useAction={() => action.useAction(1, { updateOnMount: true })} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, 'v:2 l:true e:');

  await sleep(0);
  t.is(div.textContent, 'v:2 l:false e:');
  t.is(executed, 2);
});

test.serial('clearBeforeUpdate', async (t) => {
  let executed = 0;
  const action = new Action(async (x: number) => {
    executed++;
    await sleep(0);
    return x * 2;
  });
  await action.execute(1);

  render(<Component useAction={() => action.useAction(1, { updateOnMount: true, clearBeforeUpdate: true })} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, 'v: l:true e:');

  await sleep(0);
  t.is(div.textContent, 'v:2 l:false e:');
  t.is(executed, 2);
});

test.serial('watchOnly', async (t) => {
  let executed = 0;
  const action = new Action(async (x: number) => {
    executed++;
    await sleep(0);
    return x * 2;
  });

  render(<Component useAction={() => action.useAction(1, { watchOnly: true })} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, 'v: l:false e:');

  await sleep(0);
  t.is(div.textContent, 'v: l:false e:');

  await action.execute(1);
  t.is(div.textContent, 'v:2 l:false e:');
  t.is(executed, 1);
});

test.serial('throttle', async (t) => {
  let executed = 0;
  const action = new Action(async (x: number) => {
    executed++;
    await sleep(5);
    return x + executed;
  });

  render(<Component useAction={() => action.useAction(1, { throttle: 10 })} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, 'v: l:true e:');

  await sleep(6);
  t.is(div.textContent, 'v: l:true e:');

  await sleep(6);
  t.is(div.textContent, 'v:2 l:false e:');

  t.is(executed, 1);
});

test.serial('error', async (t) => {
  const action = new Action<number, number>(async () => {
    await sleep(0);
    throw 'error';
  });

  render(<Component useAction={() => action.useAction(1)} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, 'v: l:true e:');

  await sleep(0);
  t.is(div.textContent, 'v: l:false e:error');
});

test.serial('complex key', async (t) => {
  let executed = 0;
  const action = new Action(
    async (key: { foo: string }) => {
      executed++;
      await sleep(0);
      return key.foo + executed;
    },
    { invalidateAfter: 10 }
  );

  render(<Component useAction={() => action.useAction({ foo: 'bar' })} />);
  const div = screen.getByTestId('div');
  t.is(div.textContent, 'v: l:true e:');

  await sleep(0);
  t.is(div.textContent, 'v:bar1 l:false e:');

  await sleep(15);
  t.is(div.textContent, 'v:bar2 l:false e:');
  t.is(executed, 2);
});
