export function throttle<Args extends any[]>(fn: (...args: Args) => void, ms: number): (...args: Args) => void {
  let t = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return (...args: Args) => {
    clearTimeout(timeout);

    timeout = setTimeout(() => {
      fn(...args);
      t = Date.now();
    }, t + ms - Date.now());
  };
}
