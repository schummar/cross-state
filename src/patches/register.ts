import { patchMethods } from './patchMethods';
import { Store } from '@core';
import { autobind } from '@lib/autobind';

type PatchMethods = typeof patchMethods;

declare module '..' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Store<T> extends PatchMethods {}
}

Object.assign(Store.prototype, patchMethods);
autobind(Store);
