import * as React from 'react';
import globalState, { action1 } from './globalState';
import { useStoreState } from './state/store';

export default function App() {
  const counter = useStoreState(globalState, (x) => x.counter);
  const x = action1.use('#');

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
