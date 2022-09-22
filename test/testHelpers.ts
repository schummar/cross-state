const noopPromise = Promise.resolve();

export async function flushPromises(n = 100) {
  for (let i = 0; i < n; i++) {
    await noopPromise;
  }
}

export async function sleep(ms: number) {
  return new Promise((r) => {
    setTimeout(r, ms);
  });
}

export const getValues = (fn: any) => fn.mock.calls.map((x: any) => x[2].error ?? x[2].value);

export const testAsyncState = (x: any = {}) => {
  const state = {
    value: x.value,
    error: x.error,
    isPending: x.isPending ?? false,
    isStale: x.isStale ?? false,
    status: 'value' in x ? 'value' : 'error' in x ? 'error' : 'empty',
  };
  return Object.assign(Object.values(state), state);
};
