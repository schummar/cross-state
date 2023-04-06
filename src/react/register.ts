import { reactMethods } from './reactMethods';
import { Store } from '@core';

type ReactMethods = typeof reactMethods;

declare module '@core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Store<T> extends ReactMethods {}
}

Object.assign(Store.prototype, reactMethods);
