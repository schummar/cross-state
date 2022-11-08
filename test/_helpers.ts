export const wait = async (ticks = 1): Promise<void> => {
  for (let i = 0; i < ticks; i++) await new Promise((r) => setImmediate(r));
};

const noopPromise = Promise.resolve();

export async function flushPromises(n = 100) {
  for (let i = 0; i < n; i++) {
    await noopPromise;
  }
}
