export interface Resource {
  invalidateAll(): void;
  clearAll(): void;
}

export class ResourceGroup {
  private refMap = new WeakMap<Resource, WeakRef<Resource>>();

  private refSet = new Set<WeakRef<Resource>>();

  constructor(public readonly name?: string) {
    this.add = this.add.bind(this);
    this.delete = this.delete.bind(this);
    this.invalidateAll = this.invalidateAll.bind(this);
    this.clearAll = this.clearAll.bind(this);
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
        resource.invalidateAll();
      } else {
        this.refSet.delete(ref);
      }
    }
  }

  clearAll() {
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

export const allResources = /* @__PURE__ */ new ResourceGroup();

export function createResourceGroup(name?: string) {
  return new ResourceGroup(name);
}
