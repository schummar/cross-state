import React, { useEffect, useState } from 'react';
import { Action, Store } from '../../react';
import { sleep } from '../../src/misc';
import './App.css';

const state = new Store({
  a: 0,
  b: 0,
  time: 0,
});

setInterval(
  () =>
    state.update((state) => {
      state.time = Date.now();
    }),
  10
);

let count = 0;
const action = new Action(
  async ({ x }: { x: number }) => {
    console.log('calc action');
    await sleep(1000);
    return x * 2 + count++;
  },
  { invalidateAfter: 10000 }
);

const action2 = new Action(async (x: number) => {
  console.log('calc action2');
  await sleep(1000);
  return x * 2;
});

export default function App() {
  return (
    <div className="App">
      <A />
      <B />
      <C />
      <D />
      <E />
      <F />
    </div>
  );
}

function A() {
  const value = state.useState((x) => x.a);
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
  const value = state.useState((x) => x.a + x.b);
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
  const value = state.useState((x) => x[prop], [prop]);
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
    action.execute({ x: 42 });
    action.execute({ x: 42 });
    action.clearCacheAll();
    action.execute({ x: 42 });
    setTimeout(() => {
      action.clearCacheAll();
      action.execute({ x: 42 });
    }, 0);
    setTimeout(() => {
      action.clearCacheAll();
      action.execute({ x: 42 });
    }, 1);
  }

  return (
    <div>
      <div>action:</div>
      <div>
        <span onClick={() => setMounted(!mounted)}>mount</span>
        <span onClick={() => action.execute({ x: 42 })}>update</span>
        <span onClick={() => Action.clearCacheAll()}>clear</span>
        <span onClick={() => action.invalidateCache({ x: 42 })}>invalidate</span>
        <span onClick={fuck}>fuck</span>
        {mounted && <DInner />}
      </div>
    </div>
  );
}

function DInner() {
  const [x, { error, isLoading }] = action.useAction({ x: 42 }, { updateOnMount: true });

  return (
    <>
      {error} {isLoading && '...'} {x}
    </>
  );
}

function E() {
  const value = state.useState((x) => x.time, [], { throttle: 10000 });
  console.log('render_d', value);

  return (
    <div>
      <div>e:</div>
      <div>{new Date(value).toLocaleString()}</div>
    </div>
  );
}

function F() {
  const [counter, setCounter] = useState(0);
  const [x, { error, isLoading }] = action2.useAction(counter);

  console.log('render_f', { counter, x, inconsistent: x !== undefined && x !== counter * 2 });

  useEffect(() => {
    const handle = setInterval(() => setCounter((c) => c + 1), 1000);
    return () => clearInterval(handle);
  });

  return (
    <>
      {error} {isLoading && '...'} {x}
    </>
  );
}
