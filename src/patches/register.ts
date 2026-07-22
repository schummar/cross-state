import { patchMethods, type PatchOptions, type PatchState } from './patchMethods';
import { Store } from '@core';
import { autobind } from '@lib/autobind';

type PatchMethods = typeof patchMethods;

declare module '..' {
  interface StoreOptions<T> extends PatchOptions {}

  interface Store<T> extends PatchMethods {
    __patches?: PatchState<T>;
  }
}

Object.assign(Store.prototype, patchMethods);
autobind(Store);
