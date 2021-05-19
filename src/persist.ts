import { Patch } from 'immer';
import { get, isAncestor, Path, split } from './persistPathHelpers';
import { PersistPaths } from './persistPaths';
import { StorePersistStorage } from './persistStorage';
import { Store } from './store';

export class Persist<T> {
  initialization = this.load();
  private isStopped = false;
  private sub?: () => void;
  private saveQueue = new Array<{ path: Path; t: number }>();
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

  private async load() {
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
    keys.sort((a, b) => a.length - b.length);

    const patches = new Array<Patch & { persist: Persist<T> }>();
    for (const key of keys) {
      const value = await storage.getItem(key);
      if (value) {
        patches.push({
          path: key.split('.'),
          op: 'replace',
          value: JSON.parse(value),
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
    const match = this.paths.find((p) => isAncestor(p.path, path));
    if (!match) return;

    path = path.slice(0, match.path.length);
    const t = Date.now() + (match.throttleMs ?? 0);

    if (this.saveQueue.some((i) => i.t <= t && isAncestor(i.path, path))) return;
    this.saveQueue.push({ path, t });
    this.saveQueue.sort((a, b) => a.t - b.t);
    this.run();
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
      await this.save(next.path);
    } finally {
      this.isSaving = false;
      this.run();
    }
  }

  private async save(path: Path) {
    const { store, storage } = this;
    let value = get(store.getState(), path);

    const subPaths = this.paths
      .filter((p) => isAncestor(path, p.path) && p.path.length > path.length)
      .map((p) => p.path.slice(path.length));

    const subValues = new Array<{ path: Path; value: unknown }>();
    for (const subPath of subPaths) {
      const result = split(value, subPath);
      value = result[0];
      subValues.push(...result[1].map((s) => ({ path: [...path, ...s.path], value: s.value })));
    }

    const result = storage.setItem(path.join('.'), JSON.stringify(value));
    if (result instanceof Promise) await result;
    for (const { path, value } of subValues) {
      const result = storage.setItem(path.join('.'), JSON.stringify(value));
      if (result instanceof Promise) await result;
    }
  }

  stop(): void {
    this.isStopped = true;
    this.sub?.();
  }
}
