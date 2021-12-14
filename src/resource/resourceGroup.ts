import { Resource } from './resource';

export class ResourceGroup {
  resources = new Array<Resource<any, any>>();

  invalidateCacheAll() {
    for (const resource of this.resources) {
      resource.invalidateCacheAll();
    }
  }

  clearCacheAll() {
    for (const resource of this.resources) {
      resource.clearCacheAll();
    }
  }
}

export const globalResouceGroup = new ResourceGroup();
