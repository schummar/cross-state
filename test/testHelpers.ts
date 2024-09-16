import { isObject } from '@lib/helpers';

const noopPromise = Promise.resolve();

export async function flushPromises(n = 100): Promise<void> {
  for (let i = 0; i < n; i++) {
    await noopPromise;
  }
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const getValues = (function_: any): any =>
  function_.mock.calls.map(([x]: any) =>
    isObject(x) && 'status' in x ? (x?.error ?? x?.value) : x,
  );
