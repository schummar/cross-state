import { Action, Store, useAction, useStoreState } from 'mystate';
import React from 'react';

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
    <div>
      <A />
      <B />
      <C />
      <D />
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

  return <div onClick={click}>{value}</div>;
}
function B() {
  const value = useStoreState(state, (x) => x.b);
  console.log('render b', value);

  function click() {
    state.update((state) => {
      state.b++;
    });
  }

  return <div onClick={click}>{value}</div>;
}

function C() {
  const value = useStoreState(state, (x) => x.a + x.b);
  console.log('render c', value);

  return <div>{value}</div>;
}

function D() {
  const [x, { error, isLoading }] = useAction(action, 42);
  console.log(x, error, isLoading);

  function click() {
    action.clearAllCached();
  }

  return <div onClick={click}>{x}</div>;
}
