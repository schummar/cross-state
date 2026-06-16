import type { Cancel, DisposableCancel, SubscribeOptions } from '@core/commonTypes';
import type { Store } from '@core/store';
import { applyPatches as _applyPatches } from '@lib/applyPatches';
import { diff, type DiffOptions, type Patch } from '@lib/diff';
import { fromExtendedJson, toExtendedJson } from '@lib/extendedJson';
import { Trie } from '@lib/trie';

export interface SyncMessage {
  fromVersion?: string;
  toVersion: string;
  patches: Patch[];
}

export interface HistoryEntry extends SyncMessage {
  reversePatches: Patch[];
}

declare module '@core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Store<T> {
    __patches?: {
      value: T;
      version: string;
      history: HistoryEntry[];
    };
  }
}

export interface SubscribePatchOptions extends SubscribeOptions, DiffOptions {
  /** @default false */
  runNow?: boolean;
  /** try to start from a specific version and only receive patches after that.
   * If the id is not found, it will start from the beginning */
  startAt?: string;
}

export type InteropPatch = Patch | { op: 'add' | 'replace' | 'remove'; value?: any };

const genId = () => Math.random().toString(36).slice(2);

export function subscribePatches<T>(
  this: Store<T>,
  listener: (
    this: { cancel: Cancel },
    patches: Patch[],
    reversePatches: Patch[],
    version: string,
    previousVersion: string | undefined,
  ) => void,
  options: SubscribePatchOptions = {},
): DisposableCancel {
  const patches = (this.__patches ??= {
    value: this.get(),
    version: genId(),
    history: [],
  });

  options = { ...options };
  options.runNow ??= false;
  let cursor = options.startAt ?? (options.runNow ? undefined : this.__patches.version);

  return this.subscribe(function (value) {
    if (patches.value !== value) {
      const result = diff(patches.value, value, options);
      patches.value = value;

      if (result[0].length > 0) {
        const newVersion = genId();

        patches.history = patches.history
          .concat({
            fromVersion: patches.version,
            toVersion: newVersion,
            patches: result[0],
            reversePatches: result[1],
          })
          .slice(-1000);

        patches.version = newVersion;
      }
    }

    if (cursor === patches.version) return;
    const index = patches.history.findIndex((h) => h.fromVersion === cursor);
    let forward, backward, previousVersion;

    if (index === -1) {
      [forward, backward] = diff(undefined, value, options);
      previousVersion = undefined;
    } else {
      forward = patches.history.slice(index).flatMap((h) => h.patches);
      backward = patches.history.slice(index).flatMap((h) => h.reversePatches);
      previousVersion = cursor;
    }

    cursor = patches.version;
    listener.apply(this, [forward, backward, cursor, previousVersion]);
  }, options);
}

export function applyPatches<T>(this: Store<T>, patches: InteropPatch[]): void;
export function applyPatches<T>(this: Store<T>, ...patches: InteropPatch[]): void;
export function applyPatches<T>(
  this: Store<T>,
  ...patches: (InteropPatch | InteropPatch[])[]
): void {
  this.set((value) => _applyPatches(value, ...(patches.flat() as Patch[])));
}

export function sync<T>(
  this: Store<T>,
  listener: (syncMessage: SyncMessage) => void,
  options?: Omit<SubscribePatchOptions, 'runNow'>,
): DisposableCancel {
  const debounce =
    typeof options?.debounce === 'object' && 'wait' in options.debounce
      ? { ...options.debounce }
      : options?.debounce !== undefined
        ? { wait: options.debounce }
        : undefined;

  if (debounce) {
    debounce.waitOnRunNow ??= false;
  }

  return subscribePatches.apply<
    Store<T>,
    Parameters<typeof subscribePatches<T>>,
    ReturnType<typeof subscribePatches<T>>
  >(this, [
    (patches, _, version, previousVersion) => {
      const trie = new Trie();

      patches = [...patches]
        .reverse()
        .filter((patch) => {
          if (trie.hasSubPath(patch.path)) {
            return false;
          }

          trie.add(patch.path);
          return true;
        })
        .reverse();

      listener({
        fromVersion: previousVersion,
        toVersion: version,
        patches: toExtendedJson(patches) as Patch[],
      });
    },
    { ...options, debounce, runNow: true },
  ]);
}

export function acceptSync<T>(this: Store<T>, message: SyncMessage): void {
  if (message.fromVersion && message.fromVersion !== this.version) {
    throw new Error(
      `version mismatch! version=${this.version}, fromVersion=${message.fromVersion}`,
    );
  }

  const patches = fromExtendedJson(message.patches) as Patch[];

  this.version = message.toVersion;
  applyPatches.apply<Store<T>, Patch[], void>(this, patches);
}

export const patchMethods: {
  subscribePatches: typeof subscribePatches;
  applyPatches: typeof applyPatches;
  sync: typeof sync;
  acceptSync: typeof acceptSync;
} = {
  subscribePatches,
  applyPatches,
  sync,
  acceptSync,
};
