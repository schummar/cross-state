export interface DebounceOptions {
  wait?: number;
  maxWait?: number;
}

export function debounce<Args extends any[]>(fn: (...args: Args) => void, options: number | DebounceOptions): (...args: Args) => void {
  const { wait = 0, maxWait = 0 } = typeof options === 'number' ? { wait: options } : options;

  let deadline: number | undefined;
  let lastArgs: Args | undefined;
  let timeout: NodeJS.Timeout | undefined;

  function run() {
    const args = lastArgs;

    deadline = undefined;
    lastArgs = undefined;
    timeout = undefined;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    fn(...args!);
  }

  return function (...args: Args) {
    const now = Date.now();
    deadline ??= maxWait? now + maxWait : Infinity;
    lastArgs = args;
    const nextRun = Math.min(now + wait, deadline);

    if (timeout) {
      clearTimeout(timeout);
    }

    if (now < nextRun) {
      timeout = setTimeout(run, nextRun - now);
    } else {
      run();
    }
  };
}
