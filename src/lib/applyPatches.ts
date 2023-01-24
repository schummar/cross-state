import type { Patch } from './diff';
import { remove, set } from './propAccess';

function applySinglePatch<T>(target: T, patch: Patch): T {
  if (patch.op === 'remove') {
    return remove(target, patch.path as any);
  }

  return set(target, patch.path as any, patch.value);
}

export function applyPatches<T>(target: T, ...patches: Patch[]): T {
  for (const patch of patches) {
    target = applySinglePatch(target, patch);
  }

  return target;
}
