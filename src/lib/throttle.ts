export function throttle<Args extends any[]>(
  action: (...args: Args) => void,
  ms: number,
): (...args: Args) => void {
  let t = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return (...args: Args) => {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }

    const dt = t + ms - Date.now();
    if (dt <= 0) {
      action(...args);
      t = Date.now();
      return;
    }

    timeout = setTimeout(() => {
      action(...args);
      t = Date.now();
    }, dt);
  };
}
