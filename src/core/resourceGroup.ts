export interface Resource {
  invalidate(): void;
  clear(): void;
}

export class ResourceGroup extends Set<Resource> {
  invalidate() {
    for (const resource of this) {
      resource.invalidate();
    }
  }

  clear() {
    for (const resource of this) {
      resource.clear();
    }
  }
}

export const allResources = new ResourceGroup();
