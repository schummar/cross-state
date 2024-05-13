import { Store } from '@core';
import { autobind } from '@lib/autobind';
import { patchMethods } from './patchMethods';

type PatchMethods = typeof patchMethods;

declare module '@core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Store<T> extends PatchMethods {}
}

Object.assign(Store.prototype, patchMethods);
autobind(Store);
