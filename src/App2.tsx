import * as React from 'react';
import globalState from './globalState';
import { useStoreState } from './state/store';

export default function App() {
  const counter = useStoreState(globalState, (x) => x.counter2);
  console.log('render app2');

  function click() {
    globalState.update((state) => {
      state.counter2++;
    });
  }

  return (
    <div>
      <div>{counter}</div>
      <button onClick={click}>click</button>
    </div>
  );
}
