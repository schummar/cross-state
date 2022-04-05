export function throttle<Args extends any[]>(fn: (...args: Args) => void, ms: number): (...args: Args) => void {
  let t = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return (...args: Args) => {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }

    const dt = t + ms - Date.now();
    if (dt <= 0) {
      fn(...args);
      t = Date.now();
      return;
    }

    timeout = setTimeout(() => {
      fn(...args);
      t = Date.now();
    }, dt);
  };
}
