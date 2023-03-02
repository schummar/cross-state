import { bind } from '@lib/bind';

export interface Resource {
  invalidate(): void;
  clear(): void;
}

export class ResourceGroup {
  private refMap = new WeakMap<Resource, WeakRef<Resource>>();

  private refSet = new Set<WeakRef<Resource>>();

  constructor(public readonly name?: string) {
    bind(this);
  }

  add(resource: Resource) {
    const ref = new WeakRef(resource);
    this.refMap.set(resource, ref);
    this.refSet.add(ref);
  }

  delete(resource: Resource) {
    const ref = this.refMap.get(resource);
    if (ref) {
      this.refMap.delete(resource);
      this.refSet.delete(ref);
    }
  }

  invalidateAll() {
    for (const ref of this.refSet) {
      const resource = ref.deref();
      if (resource) {
        resource.invalidate();
      } else {
        this.refSet.delete(ref);
      }
    }
  }

  clearAll() {
    for (const ref of this.refSet) {
      const resource = ref.deref();
      if (resource) {
        resource.clear();
      } else {
        this.refSet.delete(ref);
      }
    }
  }
}

export const allResources = new ResourceGroup();

export function createResourceGroup(name?: string) {
  return new ResourceGroup(name);
}
