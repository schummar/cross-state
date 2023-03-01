import { bind } from '@lib/bind';

export interface Resource {
  invalidate(): void;
  clear(): void;
}

export class ResourceGroup {
  resources = new Set<Resource>();

  constructor(public readonly name?: string) {
    bind(this);
  }

  invalidateAll() {
    for (const resource of this.resources) {
      resource.invalidate();
    }
  }

  clearAll() {
    for (const resource of this.resources) {
      resource.clear();
    }
  }
}

export const allResources = new ResourceGroup();

export function createResourceGroup(name?: string) {
  return new ResourceGroup(name);
}
