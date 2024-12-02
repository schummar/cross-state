export * from './core';
export { applyPatches } from './lib/applyPatches';
export { calcDuration } from './lib/calcDuration';
export { diff, type Patch } from './lib/diff';
export { deepEqual, shallowEqual, strictEqual } from './lib/equals';
export { hash, simpleHash, type Hashable } from './lib/hash';
export { InstanceCache } from './lib/instanceCache';
export {
  type Path,
  type PathAsArray,
  type PathAsString,
  type SettablePath,
  type SettablePathAsArray,
  type SettablePathAsString,
  type Value,
} from './lib/path';
export { get, set } from './lib/propAccess';
export { arrayMethods, mapMethods, recordMethods, setMethods } from './lib/standardMethods';
export * from './lib/updateHelpers';
export * from './persist';
