import React, { useState } from 'react';
import globalState from './globalState';
import { Action } from './state/action';
import { useAction } from './state/useAction';
import { useStoreState } from './state/useStoreState';

const action = new Action(async (x: number) => {
  await new Promise((r) => setTimeout(r, 1000));
  return x * 2;
});

export default function App() {
  const counter = useStoreState(globalState, (x) => x.counter);
  const x = useAction(action, 42);
  console.log(x);

  function click() {
    globalState.update((state) => {
      state.counter++;
    });
  }

  return (
    <div>
      <div>{JSON.stringify(x)}</div>
      <div>{counter}</div>
      <button onClick={click}>click</button>
    </div>
  );
}
