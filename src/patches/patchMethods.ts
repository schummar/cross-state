import type { SubscribeOptions } from '@core';
import type { Store } from '@core/store';
import { applyPatches as _applyPatches } from '@lib/applyPatches';
import { diff, type DiffOptions, type Patch } from '@lib/diff';

declare module '@core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Store<T> {
    __patches?: Store<[Patch[], Patch[]]>;
  }
}

export interface SubscribePatchOptions extends SubscribeOptions, DiffOptions {
  /** @default false */
  runNow?: boolean;
}

export interface SyncMessage {
  id: string;
  previousId?: string;
  patches: Patch[];
}

export type InteropPatch = Patch | { op: 'add' | 'replace' | 'remove'; value?: any };

const genId = () => Math.random().toString(36).slice(2);

function subscribePatches<T>(
  this: Store<T>,
  listener: (patches: Patch[], reversePatches: Patch[]) => void,
  options?: SubscribePatchOptions,
) {
  if (!this.__patches) {
    let previousValue = this.get();

    this.__patches = this.map((value) => {
      const result = diff(previousValue, value, options);
      previousValue = value;
      return result;
    });
  }

  const { stopAt, runNow, ...subscribeOptions } = options ?? {};

  const cancel = this.__patches.subscribe((p) => listener(...p), subscribeOptions);

  if (runNow) {
    listener(...diff(undefined, this.get(), options));
  }

  return cancel;
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
) {
  let previousId: string | undefined;

  return this.subscribePatches(
    (patches) => {
      const id = genId();
      const message = { id, previousId, patches };
      previousId = id;

      listener(message);
    },
    { ...options, runNow: true },
  );
}

function acceptSync<T>(this: Store<T>) {
  let previousId: string | undefined;

  return (message: SyncMessage) => {
    if (message.previousId && message.previousId !== previousId) {
      throw new Error('previousId mismatch');
    }

    previousId = message.id;
    this.applyPatches(...message.patches);
  };
}

export const patchMethods = {
  subscribePatches,
  applyPatches,
  sync,
  acceptSync,
};
