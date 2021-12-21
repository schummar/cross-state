/**
 * @jest-environment jsdom
 */

import { expect, test } from '@jest/globals';
import { act, render, screen } from '@testing-library/react';
import { startTransition, useEffect, useState } from 'react';
import { Store } from '../../src/react';
import { sleep } from '../_helpers';

const store = new Store({ x: 0 });
let maxCount = 0;

function SlowComponent() {
  useEffect(() => {
    const elements = document.querySelectorAll('h3');
    const numbers = new Set(Array.from(elements).map((x) => x.textContent));
    maxCount = Math.max(maxCount, numbers.size);
  });

  const now = performance.now();
  while (performance.now() - now < 200) {
    // do nothing
  }
  const state = store.useState('x');

  return <h3>{state},</h3>;
}

function App() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let count = 0;
    const t = setInterval(() => {
      store.update((state) => {
        state.x++;
      });
      if (count++ > 10) clearInterval(t);
    }, 50);
    return () => clearInterval(t);
  }, []);

  return (
    <div data-testid="div">
      <button
        onClick={() => {
          startTransition(() => {
            setShow(!show);
          });
        }}
      >
        toggle content
      </button>

      {show && (
        <>
          <SlowComponent />
          <SlowComponent />
          <SlowComponent />
          <SlowComponent />
          <SlowComponent />
        </>
      )}
    </div>
  );
}

test('tearing', async () => {
  render(<App />);
  act(() => screen.getByRole('button').click());

  await act(async () => {
    await sleep(5000);
  });
  expect(maxCount).toBe(1);
}, 10000);
