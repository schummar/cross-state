import { queue } from '../lib/queue';
import { BaseStore } from '../types';
import { PersistOptions } from './persistOptions';
import { PersistStorage } from './persistStorage';

export function persist<T>(s: BaseStore<T>, storage: PersistStorage, options: PersistOptions<T>) {
  const { id, throttle } = options;
  let canceled = false;
  let handle: (() => void) | undefined;
  const q = queue();
  let hasHydrated = false;

  const init = async () => {
    try {
      const value = await storage.getItem(id);
      if (value !== null) {
        const parsed = value === 'undefined' ? undefined : JSON.parse(value);
        s.set(parsed);
        hasHydrated = true;
      }
    } catch (e) {
      console.error('Failed to restore store persist:', e);
    }

    if (!canceled) {
      watch();
    }
  };

  const watch = () => {
    handle = s.subscribe(
      async (value) => {
        try {
          await q(() => storage.setItem(id, JSON.stringify(value)));
        } catch (e) {
          console.error('Failed to save store persist:', e);
        }
      },
      {
        throttle,
        runNow: !hasHydrated,
      }
    );
  };

  const hydrated = init();

  const stop = () => {
    canceled = true;
    handle?.();
    q.clear();
  };

  return {
    hydrated,
    stop,
  };
}
