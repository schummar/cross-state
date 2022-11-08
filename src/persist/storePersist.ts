import { Patch } from 'immer';
import { Store } from '../store';
import { get, isAncestor, Path, split } from './persistPathHelpers';
import { PersistPaths } from './persistPaths';
import { StorePersistStorage } from './persistStorage';

export class StorePersist<T> {
  initialization = this.load();
  private isStopped = false;
  private sub?: () => void;
  private saveQueue = new Array<{ path: Path; t: number; descendantsOnly?: boolean }>();
  private isSaving = false;
  private saveTimeout?: NodeJS.Timeout;
  private paths: { path: Path; throttleMs?: number }[];

  constructor(
    public readonly store: Store<T>,
    public readonly storage: StorePersistStorage,
    public readonly options: {
      paths?: (PersistPaths<T> | { path: PersistPaths<T>; throttleMs?: number })[];
      throttleMs?: number;
    } = {}
  ) {
    if (!options.paths) {
      this.paths = [{ path: [], throttleMs: options.throttleMs }];
    } else {
      this.paths = options.paths.map((p) => ({
        path: (typeof p === 'object' ? p.path : p).split('.'),
        throttleMs: (typeof p === 'object' ? p.throttleMs : undefined) ?? options.throttleMs,
      }));
    }

    this.paths.sort((a, b) => b.path.length - a.path.length);
  }

  private async getKeys() {
    const storage = this.storage;

    let keys;
    if ('keys' in storage) {
      keys = await storage.keys();
    } else {
      const length = storage.length instanceof Function ? await storage.length() : storage.length;
      keys = new Array<string>();
      for (let i = 0; i < length; i++) {
        const key = await storage.key(i);
        if (key !== null) keys.push(key);
      }
    }

    return keys;
  }

  private async load() {
    const storage = this.storage;

    const keys = await this.getKeys();
    keys.sort((a, b) => a.length - b.length);

    const patches = new Array<Patch & { persist: StorePersist<T> }>();
    for (const key of keys) {
      const value = await storage.getItem(key);
      if (value) {
        patches.push({
          path: key === '' ? [] : key.split('.'),
          op: 'replace',
          value: value === 'undefined' ? undefined : parse(value),
          persist: this,
        });
      }
    }

    if (this.isStopped) return;
    if (patches.length > 0) this.store.applyPatches(patches);
    this.watch(patches.length === 0);
  }

  private watch(isInitialized: boolean) {
    this.sub = this.store.subscribePatches((patches) => {
      for (const patch of patches) {
        if ((patch as any).persist === this) {
          isInitialized = true;
        } else if (isInitialized) {
          this.addToSaveQueue(patch.path);
        }
      }
    });
  }

  private addToSaveQueue(path: Path) {
    const ancestor = this.paths.find((p) => isAncestor(p.path, path));
    const hasDescendants = this.paths.some((p) => isAncestor(path, p.path));

    if (ancestor) {
      path = path.slice(0, ancestor.path.length);
      const t = Date.now() + (ancestor.throttleMs ?? 0);

      if (this.saveQueue.some((i) => i.t <= t && isAncestor(i.path, path))) return;
      this.saveQueue.push({ path, t });
      this.saveQueue.sort((a, b) => a.t - b.t);
      this.run();
    } else if (hasDescendants) {
      this.saveQueue.unshift({ path, t: 0, descendantsOnly: true });
      this.run();
    }
  }

  private async run() {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    const next = this.saveQueue[0];

    if (!next) return;
    if (next.t > Date.now()) {
      this.saveTimeout = setTimeout(() => this.run(), next.t - Date.now());
      return;
    }

    try {
      this.isSaving = true;
      this.saveQueue.shift();
      await this.save(next.path, next.descendantsOnly);
    } finally {
      this.isSaving = false;
      this.run();
    }
  }

  private async save(path: Path, descendantsOnly?: boolean) {
    const { store, storage } = this;
    let value = get(store.getState(), path);

    const obsoletePaths = (await this.getKeys()).filter((key) => {
      const p = key.split('.');
      return p.length > path.length && isAncestor(path, key.split('.'));
    });
    for (const p of obsoletePaths) {
      const result = storage.removeItem(p);
      if (result instanceof Promise) await result;
    }

    const subPaths = this.paths
      .filter((p) => isAncestor(path, p.path) && p.path.length > path.length)
      .map((p) => p.path.slice(path.length));

    const subValues = new Array<{ path: Path; value: unknown }>();
    for (const subPath of subPaths) {
      const result = split(value, subPath);
      value = result[0];
      subValues.push(...result[1].map((s) => ({ path: [...path, ...s.path], value: s.value })));
    }

    if (!descendantsOnly) {
      const result = value !== undefined ? storage.setItem(path.join('.'), stringify(value)) : storage.removeItem(path.join('.'));
      if (result instanceof Promise) await result;
    }

    for (const { path, value } of subValues) {
      const result = value !== undefined ? storage.setItem(path.join('.'), stringify(value)) : storage.removeItem(path.join('.'));
      if (result instanceof Promise) await result;
    }
  }

  stop(): void {
    this.isStopped = true;
    this.sub?.();
  }
}

function stringify(value: any) {
  function prepare(value: any): any {
    if (value instanceof Date) {
      return { __date: value.toJSON() };
    }

    if (value instanceof Set) {
      return { __set: Array.from(value).map(prepare) };
    }

    if (value instanceof Map) {
      return { __map: Array.from(value.entries()).map((entry) => entry.map(prepare)) };
    }

    if (value instanceof Array) {
      return value.map(prepare);
    }

    if (value instanceof Object) {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, prepare(v)]));
    }

    return value;
  }

  return JSON.stringify(prepare(value));
}

function parse(value: string) {
  return JSON.parse(value, (_key, value) => {
    if (value instanceof Object && '__date' in value) {
      return new Date(value.__date);
    }

    if (value instanceof Object && '__set' in value) {
      return new Set(value.__set);
    }

    if (value instanceof Object && '__map' in value) {
      return new Map(value.__map);
    }

    return value;
  });
}
