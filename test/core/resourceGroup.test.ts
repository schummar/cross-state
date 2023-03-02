import { describe, expect, test } from "vitest";
import { allResources, createCache, createResourceGroup, ResourceGroup } from "../../src";

describe('resourceGroup', () => {
    describe('allResources', () => {
      test('invalidateAll', async () => {
        const cache = createCache(async () => 1);
        await cache.get();
  
        expect(cache.state.get().isStale).toBe(false);
  
        allResources.invalidateAll();
        expect(cache.state.get().isStale).toBe(true);
      });
  
      test('clearAll', async () => {
        const cache = createCache(async () => 1);
        await cache.get();
  
        expect(cache.state.get().value).toBe(1);
  
        allResources.clearAll();
        expect(cache.state.get().value).toBe(undefined);
      });
    });
  
    describe('custom resourceGroup', () => {
      test('create', async () => {
        const resourceGroup = createResourceGroup('test');
        expect(resourceGroup).toBeInstanceOf(ResourceGroup);
        expect(resourceGroup.name).toBe('test');
      });
  
      test('invalidateAll', async () => {
        const resourceGroup = createResourceGroup();
        const cache = createCache(async () => 1, { resourceGroup });
        await cache.get();
  
        expect(cache.state.get().isStale).toBe(false);
  
        resourceGroup.invalidateAll();
        expect(cache.state.get().isStale).toBe(true);
      });
  
      test('clearAll', async () => {
        const resourceGroup = createResourceGroup();
        const cache = createCache(async () => 1, { resourceGroup });
        await cache.get();
  
        expect(cache.state.get().value).toBe(1);
  
        resourceGroup.clearAll();
        expect(cache.state.get().value).toBe(undefined);
      });
    });
  });
  