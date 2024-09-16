import type { DisposableCancel, SubscribeOptions } from '@core/commonTypes';
import type { Store } from '@core/store';
import { applyPatches as _applyPatches } from '@lib/applyPatches';
import { diff, type DiffOptions, type Patch } from '@lib/diff';

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
    __patches?: Store<{
      version: string;
      history: HistoryEntry[];
    }>;
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

function subscribePatches<T>(
  this: Store<T>,
  listener: (
    patches: Patch[],
    reversePatches: Patch[],
    version: string,
    previousVersion: string | undefined,
  ) => void,
  options: SubscribePatchOptions = {},
): DisposableCancel {
  if (!this.__patches) {
    let version = genId();
    let previousValue = this.get();
    let patches: HistoryEntry[] = [];

    this.__patches = this.map((value) => {
      const result = diff(previousValue, value, options);
      previousValue = value;
      const newVersion = genId();

      patches = patches
        .concat({
          fromVersion: version,
          toVersion: newVersion,
          patches: result[0],
          reversePatches: result[1],
        })
        .slice(-1000);

      version = newVersion;
      return { version, history: patches };
    });
  }

  options.runNow ??= false;
  let cursor = options.startAt;

  if (!options.runNow && !options.startAt) {
    cursor = this.__patches.get().version;
  }

  return this.__patches.subscribe((p) => {
    if (cursor === p.version) {
      return;
    }

    const index = p.history.findIndex((h) => h.fromVersion === cursor);
    let forward, backward, previousVersion;

    if (index === -1) {
      [forward, backward] = diff(undefined, this.get(), options);
      previousVersion = undefined;
    } else {
      forward = p.history.slice(index).flatMap((h) => h.patches);
      backward = p.history.slice(index).flatMap((h) => h.reversePatches);
      previousVersion = cursor;
    }

    cursor = p.version;
    if (forward.length > 0) {
      listener(forward, backward, cursor, previousVersion);
    }
  }, options);
}

function applyPatches<T>(this: Store<T>, patches: InteropPatch[]): void;
function applyPatches<T>(this: Store<T>, ...patches: InteropPatch[]): void;
function applyPatches<T>(this: Store<T>, ...patches: (InteropPatch | InteropPatch[])[]): void {
  this.set((value) => _applyPatches(value, ...(patches.flat() as Patch[])));
}

function sync<T>(
  this: Store<T>,
  listener: (syncMessage: SyncMessage) => void,
  options?: Omit<SubscribePatchOptions, 'runNow'>,
): DisposableCancel {
  return this.subscribePatches(
    (patches, _, version, previousVersion) => {
      listener({
        fromVersion: previousVersion,
        toVersion: version,
        patches,
      });
    },
    { ...options, runNow: true },
  );
}

function acceptSync<T>(this: Store<T>, message: SyncMessage): void {
  if (message.fromVersion && message.fromVersion !== this.version) {
    throw new Error(
      `version mismatch! version=${this.version}, fromVersion=${message.fromVersion}`,
    );
  }

  this.version = message.toVersion;
  this.applyPatches(...message.patches);
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
