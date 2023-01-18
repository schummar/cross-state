export interface Resource {
  invalidate(): void;
  clear(): void;
}

export class ResourceGroup extends Set<Resource> {
  invalidateAll() {
    for (const resource of this) {
      resource.invalidate();
    }
  }

  clearAll() {
    for (const resource of this) {
      resource.clear();
    }
  }
}

export const _allResources = new ResourceGroup();
export const allResources = {
  invalidateAll: _allResources.invalidateAll.bind(_allResources),
  clearAll: _allResources.clearAll.bind(_allResources),
};
