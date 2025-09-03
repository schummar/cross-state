import { Cache, Scope, Store } from '@core';
import { autobind } from '@lib/autobind';
import { cacheMethods } from '@react/cacheMethods';
import { scopeMethods } from '@react/scopeMethods';
import { storeMethods } from './storeMethods';

type StoreMethods = typeof storeMethods;
type CacheMethods = typeof cacheMethods;
type ScopeMethods = typeof scopeMethods;

declare module '..' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Store<T> extends StoreMethods {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Cache<T> extends CacheMethods {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Scope<T> extends ScopeMethods {}
}

Object.assign(Store.prototype, storeMethods);
autobind(Store);

Object.assign(Cache.prototype, cacheMethods);
autobind(Cache);

Object.assign(Scope.prototype, scopeMethods);
autobind(Scope);
