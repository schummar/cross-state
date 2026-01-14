import { assert, describe, expect, test } from 'vitest';
import { ResourceGroup } from '../../src/core/resourceGroup';

declare const gc: (() => void) | undefined;

// Helper to wait for finalizers
async function waitForFinalizers() {
  // Trigger GC multiple times and wait
  // FinalizationRegistry callbacks are scheduled on the microtask queue or similar,
  // but often require a turn of the event loop *after* GC.
  for (let i = 0; i < 10; i++) {
    if (gc) {
      gc();
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describe('ResourceGroup GC', () => {
  test('cleans up refSet when resources are garbage collected', async () => {
    assert(gc, 'gc must be exposed');

    const rg = new ResourceGroup();

    // Create resources in a closure to ensure they go out of scope
    (() => {
      const resource1 = { invalidateAll: () => {}, clearAll: () => {} };
      const resource2 = { invalidateAll: () => {}, clearAll: () => {} };
      rg.add(resource1);
      rg.add(resource2);
    })();

    expect((rg as any).refSet.size).toBe(2);

    // Wait for GC and FinalizationRegistry
    await waitForFinalizers();

    expect((rg as any).refSet.size).toBe(0);
  });
});
