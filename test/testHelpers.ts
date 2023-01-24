const noopPromise = Promise.resolve();

export async function flushPromises(n = 100) {
  for (let i = 0; i < n; i++) {
    await noopPromise;
  }
}

export async function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const getValues = (function_: any) =>
  function_.mock.calls.map(([x]: any) =>
    x instanceof Object && 'status' in x ? x?.error ?? x?.value : x,
  );
