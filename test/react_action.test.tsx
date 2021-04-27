import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import test from 'ava';
import React, { useState } from 'react';
import { sleep } from '../src/misc';
import { Action } from '../src/react';

function Simple({ action, dormant }: { action: Action<number, number>; dormant?: boolean }) {
  const [value, { isLoading, error }] = action.useAction(1, dormant ? { dormant } : undefined);

  return (
    <div data-testid="div">
      v:{value} l:{JSON.stringify(isLoading)} e:{error}
    </div>
  );
}

test.serial('simple', async (t) => {
  const action = new Action(async (x: number) => {
    await sleep(10);
    return x * 2;
  });

  render(<Simple action={action} />);
  const div = screen.getByTestId('div');
  await sleep(5);
  t.is(div.textContent, 'v: l:true e:');

  await sleep(10);
  t.is(div.textContent, 'v:2 l:false e:');
});

test.serial('clear', async (t) => {
  let executed = 0;
  const action = new Action(async (x: number) => {
    executed++;
    await sleep(10);
    return x * 2 + executed;
  });

  render(<Simple action={action} />);
  const div = screen.getByTestId('div');

  await sleep(20);
  t.is(div.textContent, 'v:3 l:false e:');

  action.clearCache(1);
  await sleep(5);
  t.is(div.textContent, 'v: l:true e:');

  await sleep(1000);
  t.is(div.textContent, 'v:4 l:false e:');

  t.is(executed, 2);
});

test.serial('invalidate', async (t) => {
  let executed = 0;
  const action = new Action(async (x: number) => {
    executed++;
    await sleep(10);
    return x * 2 + executed;
  });

  render(<Simple action={action} />);
  const div = screen.getByTestId('div');

  await sleep(15);
  t.is(div.textContent, 'v:3 l:false e:');

  action.invalidateCache(1);
  await sleep(5);
  t.is(div.textContent, 'v:3 l:true e:');

  await sleep(1000);
  t.is(div.textContent, 'v:4 l:false e:');

  t.is(executed, 2);
});

test.serial('dormant', async (t) => {
  let executed = 0;
  const action = new Action(async (x: number) => {
    executed++;
    await sleep(10);
    return x * 2 + executed;
  });

  render(<Simple action={action} dormant />);
  const div = screen.getByTestId('div');

  await sleep(15);
  t.is(div.textContent, 'v: l:false e:');
});
