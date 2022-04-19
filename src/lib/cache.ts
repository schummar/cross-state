import { hash } from './hash';

export class Cache<Args extends any[], T extends object> {
  private cache = new Map<string, { value: T; t: number }>();
  private weakRefs = new Map<string, WeakRef<T>>();
  private handle = this.cacheTime ? setInterval(() => this.cleanup(), this.cacheTime / 10) : undefined;

  constructor(private factory: (...args: Args) => T, private cacheTime?: number) {}

  cleanup() {
    const cutoff = Date.now() - (this.cacheTime ?? 0);

    for (const [key, ref] of [...this.weakRefs.entries()]) {
      if (ref.deref() === undefined) {
        this.weakRefs.delete(key);
      }
    }

    for (const [key, { t }] of [...this.cache.entries()]) {
      if (t <= cutoff && !this.weakRefs.has(key)) {
        this.cache.delete(key);
      }
    }
  }

  get(...args: Args) {
    const key = hash(args);
    let entry = this.cache.get(key);

    if (!entry) {
      const value = this.factory(...args);
      entry = {
        value,
        t: Date.now(),
      };

      this.cache.set(key, entry);

      if (typeof WeakRef !== 'undefined') {
        this.weakRefs.set(key, new WeakRef(value));
      }
    } else {
      entry.t = Date.now();
    }

    return entry.value;
  }

  values() {
    return [...this.cache.values()].map((entry) => entry.value);
  }

  stop() {
    if (this.handle) {
      clearInterval(this.handle);
    }
  }
}
