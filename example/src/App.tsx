import { Action, Store } from '../..';
import { useAction, useStoreState } from '../../react';
import React, { useState } from 'react';
import './App.css';

const state = new Store({
  a: 1,
  b: 1,
  c: 1,
});

const action = new Action(async (x: number) => {
  console.log('calc action');
  await new Promise((r) => setTimeout(r, 1000));
  return x * 2;
});

export default function App() {
  return (
    <div className="App">
      <A />
      <B />
      <C />
      <ActionContainer />
    </div>
  );
}

function A() {
  const value = useStoreState(state, (x) => x.a);
  console.log('render a', value);

  function click() {
    state.update((state) => {
      state.a++;
    });
  }

  return (
    <div onClick={click}>
      <div>a:</div>
      <div>{value}</div>
    </div>
  );
}
function B() {
  const value = useStoreState(state, (x) => x.b);
  console.log('render b', value);

  function click() {
    state.update((state) => {
      state.b++;
    });
  }

  return (
    <div onClick={click}>
      <div>b:</div>
      <div>{value}</div>
    </div>
  );
}

function C() {
  const value = useStoreState(state, (x) => x.a + x.b);
  console.log('render c', value);

  return (
    <div>
      <div>c:</div>
      <div>{value}</div>
    </div>
  );
}

function ActionContainer() {
  const [mounted, setMounted] = useState(true);

  function fuck() {
    action.run(42);
    action.run(42);
    action.clearAllCached();
    action.run(42);
    setTimeout(() => {
      action.clearAllCached();
      action.run(42);
    }, 0);
    setTimeout(() => {
      action.clearAllCached();
      action.run(42);
    }, 1);
  }

  return (
    <div>
      <div>action:</div>
      <div>
        <span onClick={() => setMounted(!mounted)}>mount</span>
        <span onClick={() => action.run(42)}>update</span>
        <span onClick={() => Action.clearAllCached()}>clear</span>
        <span onClick={fuck}>fuck</span>
        {mounted && <ActionComp />}
      </div>
    </div>
  );
}

function ActionComp() {
  const [x, { error, isLoading }] = useAction(action, 42, { clearBeforeUpdate: true });

  return (
    <>
      {error} {isLoading && '...'} {x}
    </>
  );
}
