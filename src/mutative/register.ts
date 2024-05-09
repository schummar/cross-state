import { autobind } from '@lib/autobind';
import { mutativeMethods } from './mutativeMethods';
import { Store } from '@core';

type MutativeMethods = typeof mutativeMethods;

declare module '@core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Store<T> extends MutativeMethods {}
}

Object.assign(Store.prototype, mutativeMethods);

autobind(Store);
