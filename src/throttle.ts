export function throttle<Args extends any[]>(fn: (...args: Args) => void, ms: number): (...args: Args) => void {
  let last = 0;
  let lastArgs: Args | undefined;
  let timeout: NodeJS.Timeout | undefined;

  function run() {
    if (!lastArgs) return;
    const args = lastArgs;

    last = Date.now();
    lastArgs = undefined;
    timeout = undefined;

    fn(...args);
  }

  return function (...args: Args) {
    const now = Date.now();
    lastArgs = args;

    if (timeout) {
      // do nothing
    } else if (now < last + ms) {
      lastArgs = args;
      timeout = setTimeout(run, last + ms - now);
    } else {
      lastArgs = args;
      run();
    }
  };
}
