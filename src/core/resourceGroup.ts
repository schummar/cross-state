import { autobind } from '@lib/autobind';

export interface Resource {
  invalidateAll(): void;
  clearAll(): void;
}

export class ResourceGroup {
  private refMap = new WeakMap<Resource, WeakRef<Resource>>();
  private refSet = new Set<WeakRef<Resource>>();
  private timer = setInterval(this.cleanup, 60_000);

  private registry = new FinalizationRegistry<WeakRef<Resource>>((ref) => {
    this.refSet.delete(ref);
  });

  constructor(public readonly name?: string) {
    autobind(ResourceGroup);
  }

  add(resource: Resource): void {
    const ref = new WeakRef(resource);
    this.refMap.set(resource, ref);
    this.refSet.add(ref);
    this.registry.register(resource, ref, resource);
  }

  delete(resource: Resource): void {
    const ref = this.refMap.get(resource);
    if (ref) {
      this.refMap.delete(resource);
      this.refSet.delete(ref);
      this.registry.unregister(resource);
    }
  }

  invalidateAll(): void {
    for (const ref of this.refSet) {
      const resource = ref.deref();
      if (resource) {
        resource.invalidateAll();
      } else {
        this.refSet.delete(ref);
      }
    }
  }

  clearAll(): void {
    for (const ref of this.refSet) {
      const resource = ref.deref();
      if (resource) {
        resource.clearAll();
      } else {
        this.refSet.delete(ref);
      }
    }
  }

  cleanup(): void {
    for (const ref of this.refSet) {
      if (!ref.deref()) {
        this.refSet.delete(ref);
      }
    }
  }

  stop(): void {
    clearInterval(this.timer);
    this.refSet.clear();
  }
}

export const allResources: ResourceGroup = /* @__PURE__ */ new ResourceGroup();

export function createResourceGroup(name?: string): ResourceGroup {
  return new ResourceGroup(name);
}
