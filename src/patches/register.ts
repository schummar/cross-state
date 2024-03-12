import { patchMethods } from './patchMethods';
import { Store } from '@core';

type PatchMethods = typeof patchMethods;

declare module '@core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Store<T> extends PatchMethods {}
}

let backup: any;

export function register() {
  if (backup) {
    return;
  }

  backup = {};

  for (const [name, method] of Object.entries(patchMethods)) {
    if (name in Store.prototype) {
      backup[name] = (Store.prototype as any)[name];
    }

    (Store.prototype as any)[name] = method;
  }
}

export function unregister() {
  if (!backup) {
    return;
  }

  for (const key in patchMethods) {
    if (key in backup) {
      (Store.prototype as any)[key] = backup[key];
    } else {
      delete (Store.prototype as any)[key];
    }
  }

  backup = undefined;
}

register();
