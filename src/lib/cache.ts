import { hash } from './hash';

export class Cache<Args extends any[], T extends object> {
  private cache = new Map<string, { t: number; ref?: T; weakRef?: WeakRef<T> }>();

  private interval = this.cacheTime
    ? setInterval(() => this.cleanup(), Math.max(this.cacheTime / 10, 1))
    : undefined;

  constructor(private factory: (...args: Args) => T, private cacheTime?: number) {}

  cleanup() {
    const cutoff = this.now() - (this.cacheTime ?? 0);

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ref && entry.t <= cutoff) {
        delete entry.ref;
      }

      if (!entry.ref && !entry.weakRef?.deref()) {
        this.cache.delete(key);
      }
    }
  }

  get(...args: Args) {
    const key = hash(args);
    let entry = this.cache.get(key);
    let value = entry?.ref ?? entry?.weakRef?.deref();

    if (!entry || !value) {
      value = this.factory(...args);
      entry = {
        t: this.now(),
        ref: value,
        weakRef: typeof WeakRef !== 'undefined' ? new WeakRef(value) : undefined,
      };

      this.cache.set(key, entry);
    } else {
      entry.t = this.now();
      entry.ref ??= value;
    }

    return value;
  }

  values() {
    return [...this.cache.values()]
      .map((entry) => entry.ref ?? entry.weakRef?.deref())
      .filter((value): value is T => !!value);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  stats() {
    return {
      count: this.cache.size,
      withRef: [...this.cache.values()].filter((x) => !!x.ref).length,
      withWeakRef: [...this.cache.values()].filter((x) => !!x.weakRef?.deref()).length,
    };
  }

  private now() {
    return performance.now();
  }
}
