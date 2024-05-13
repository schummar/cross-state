import { autobind } from '@lib/autobind';

export interface Resource {
  invalidateAll(): void;
  clearAll(): void;
}

export class ResourceGroup {
  static {
    /* @__PURE__ */ autobind(ResourceGroup);
  }

  private refMap = new WeakMap<Resource, WeakRef<Resource>>();

  private refSet = new Set<WeakRef<Resource>>();

  constructor(public readonly name?: string) {}

  add(resource: Resource): void {
    const ref = new WeakRef(resource);
    this.refMap.set(resource, ref);
    this.refSet.add(ref);
  }

  delete(resource: Resource): void {
    const ref = this.refMap.get(resource);
    if (ref) {
      this.refMap.delete(resource);
      this.refSet.delete(ref);
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
}

export const allResources: ResourceGroup = /* @__PURE__ */ new ResourceGroup();

export function createResourceGroup(name?: string): ResourceGroup {
  return new ResourceGroup(name);
}
