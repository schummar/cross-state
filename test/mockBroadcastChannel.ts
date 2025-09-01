import { vi } from 'vitest';
import { sleep } from './testHelpers';

export default function useMockBroadcastChannel(): void {
  const broadcastChannelInstances: any[] = [];

  vi.stubGlobal(
    'BroadcastChannel',
    class {
      listener: any;

      constructor() {
        broadcastChannelInstances.push(this);
      }

      addEventListener(_event: string, listener: any) {
        this.listener = listener;
      }

      removeEventListener() {
        this.listener = undefined;
      }

      async postMessage(message: any) {
        for (const channel of broadcastChannelInstances) {
          if (channel === this) continue;
          await sleep(1);
          channel.listener?.({ data: message });
        }
      }

      close() {
        this.listener = undefined;
      }
    },
  );
}
