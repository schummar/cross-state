import { type Store } from '@core';
import { applyPatches } from '@lib/applyPatches';
import { type Patch, diff } from '@lib/diff';

export interface Message<T> {
  id: string;
  previousId?: string;
  patches: Patch[];
}

const genId = () => Math.random().toString(36).slice(2);

export class Sync<T> {
  private previousId = genId();
  private previousState = this.store.get();

  private patchStream = this.store.map((state) => {
    const id = genId();
    const previousId = this.previousId;
    const patches = diff(this.previousState, state)[0];

    this.previousId = id;
    this.previousState = state;
    return { id, previousId, patches };
  });

  constructor(public readonly store: Store<T>) {
    this.patchStream.addEffect(() => {
      this.previousId = genId();
      this.previousState = this.store.get();
    });
  }

  connectToClient(listener: (message: Message<T>) => void) {
    const cancel = this.patchStream.subscribe(listener, { runNow: false });

    listener({
      id: this.previousId,
      patches: [{ op: 'replace', path: [], value: this.previousState }],
    });

    return cancel;
  }

  async connectToServer(stream: AsyncIterable<Message<T>>) {
    let previousId;

    for await (const message of stream) {
      if (message.previousId && message.previousId !== previousId) {
        throw new Error('previousId mismatch');
      }

      previousId = message.id;
      this.store.set((state) => applyPatches(state, ...message.patches));
    }
  }
}

export function createSync<T>(store: Store<T>) {
  return new Sync(store);
}
