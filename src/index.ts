export * from './core';
export { applyPatches } from './lib/applyPatches';
export * from './lib/cacheState';
export { diff, type Patch } from './lib/diff';
export { calcDuration } from './lib/duration';
export { deepEqual, shallowEqual, strictEqual } from './lib/equals';
export {
  fromExtendedJson,
  fromExtendedJsonString,
  toExtendedJson,
  toExtendedJsonString,
} from './lib/extendedJson';
export { hash, simpleHash, type Hashable } from './lib/hash';
export { InstanceCache } from './lib/instanceCache';
export {
  type AnyPath,
  type ValidOptionalPath,
  type ValidPath,
  type ValidSettablePath,
  type ValidWildcardPath,
  type Value,
  type WildcardValue,
} from './lib/path';
export { get, set } from './lib/propAccess';
export { matches, type MatchedPath } from './lib/wildcardMatch';
export { arrayMethods, mapMethods, recordMethods, setMethods } from './lib/standardMethods';
export * from './lib/updateHelpers';
export * from './persist';
