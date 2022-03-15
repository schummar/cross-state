import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom';
import { async } from '../asyncStore';
import { store } from '../atomicStore';
import { computed } from '../computed';
import { useStore } from './useStore';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const numberStore = store(42);

const computeddStore = computed((get) => get(numberStore) * 2);

const asyncStore = async(async (get) => `async:${get(computeddStore)}`);

const pushStore = async<Record<string, number>>(async (get, register) => {
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
});

export function Playground() {
  const x = useStore(numberStore);
  const y = useStore(computeddStore);
  const [z] = useStore(asyncStore);
  const [w] = useStore(pushStore);

  return (
    <div onClick={() => numberStore.set((x) => x + 1)}>
      <div>{x}</div>
      <div>{y}</div>
      <div>{JSON.stringify(z)}</div>
      <div>{JSON.stringify(w)}</div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    <Playground />
  </StrictMode>
);
