const noopPromise = Promise.resolve();

export async function flushPromises(n = 100) {
  for (let i = 0; i < n; i++) {
    await noopPromise;
  }
}

export async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const getValues = (fn: any) => fn.mock.calls.map((x: any) => x[0].error ?? x[0].value);
