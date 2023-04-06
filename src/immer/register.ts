import { immerMethods } from './immerMethods';
import { Store } from '@core';

type ImmerMethods = typeof immerMethods;

declare module '@core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Store<T> extends ImmerMethods {}
}

Object.assign(Store.prototype, immerMethods);
