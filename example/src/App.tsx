import React, { useState } from 'react';
import { Action, Store } from '../..';
import { useAction, useStoreState } from '../../react';
import './App.css';

const state = new Store({
  a: 0,
  b: 0,
});

let count = 0;
const action = new Action(async (x: number) => {
  console.log('calc action');
  await new Promise((r) => setTimeout(r, 1000));
  return x * 2 + count++;
});

export default function App() {
  return (
    <div className="App">
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

  return (
    <div onClick={click}>
      <div>a:</div>
      <div>{value}</div>
    </div>
  );
}
function B() {
  const value = useStoreState(state, (x) => x.a + x.b);
  console.log('render b', value);

  function click() {
    state.update((state) => {
      state.b--;
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
  const [mounted, setMounted] = useState(true);

  return (
    <div>
      <div>c:</div>
      <div>
        <span onClick={() => setMounted(!mounted)}>mount</span>
        {mounted && <CInner />}
      </div>
    </div>
  );
}

function CInner() {
  const [prop, setProp] = useState<'a' | 'b'>('a');
  const value = useStoreState(state, (x) => x[prop], [prop]);
  console.log('render_c', prop, value);

  function click() {
    setProp(prop === 'a' ? 'b' : 'a');
  }

  return (
    <div onClick={click}>
      <div>{value}</div>
    </div>
  );
}

function D() {
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
        {mounted && <DInner />}
      </div>
    </div>
  );
}

function DInner() {
  const [x, { error, isLoading }] = useAction(action, 42, { updateOnMount: true });

  return (
    <>
      {error} {isLoading && '...'} {x}
    </>
  );
}
