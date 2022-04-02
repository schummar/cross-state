import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom';
import { async } from '../core/async';
import { computed } from '../core/computed';
import { store } from '../core/store';
import { recordActions } from '../core/storeActions';
import { useStore } from './useStore';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const numberStore = store(42);
const objectStore = store({ a: 1, b: 2, c: 3 } as Record<string, number>, recordActions);

const computeddStore = computed((get) => get(numberStore) * 2);

const asyncStore = async(async (_v, get) => `async:${get(computeddStore)}`)();

const pushStore = async<null, Record<string, number>>(async (_v, get, register) => {
  register((set) => {
    let stopped = false;

    (async () => {
      for (let i = 0; !stopped; i++) {
        set((items) => ({ ...items, i: get(computeddStore) + i }));
        await sleep(1000);
      }
    })().catch((e) => {
      console.error('fail', e);
    });

    return () => {
      stopped = true;
    };
  });

  await sleep(2000);
  return { computed: get(computeddStore) };
})(null);

export function Playground() {
  const x = useStore(numberStore);
  const y = useStore(computeddStore);
  const [z] = useStore(asyncStore);
  const [w] = useStore(pushStore);
  const o = useStore(objectStore);

  return (
    <div
      onClick={() => {
        numberStore.set((x) => x + 1);
        // objectStore.with('c', 42);
        objectStore.with('d', 42);
      }}
    >
      <div>{JSON.stringify(x)}</div>
      <div>{JSON.stringify(y)}</div>
      <div>{JSON.stringify(z)}</div>
      <div>{JSON.stringify(w)}</div>
      <div>{JSON.stringify(o)}</div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <Playground />
  </StrictMode>
);
