import type { MaybePromise } from '@lib/maybePromise';
import type { PersistStorageWithKeys } from '@persist';
import { sleep } from './testHelpers';

export default class MockStorage implements PersistStorageWithKeys {
  items: Map<string, string> = new Map();

  constructor(
    public readonly delay?: { get?: number; set?: number; remove?: number; keys?: number },
  ) {}

  withDelay<T>(method: 'get' | 'set' | 'remove' | 'keys', action: () => T): MaybePromise<T> {
    if (this.delay?.[method]) {
      return sleep(this.delay[method]!).then(action);
    }

    return action();
  }

  getItem(key: string): MaybePromise<string | null> {
    return this.withDelay('get', () => this.items.get(key) ?? null);
  }

  setItem(key: string, value: string): MaybePromise<void> {
    return this.withDelay('set', () => {
      this.items.set(key, value);
    });
  }

  removeItem(key: string): MaybePromise<void> {
    return this.withDelay('remove', () => {
      this.items.delete(key);
    });
  }

  keys(): MaybePromise<string[]> {
    return this.withDelay('keys', () => {
      return [...this.items.keys()];
    });
  }

  get itemsWithoutVersion(): Map<string, string> {
    return new Map([...this.items].filter(([key]) => !key.startsWith('test:version')));
  }
}
