import { diff } from '@lib/diff';
import type { FormContext } from './form';
import { get, remove, set } from '@lib/propAccess';
import { deepEqual } from '@lib/equals';

export interface OnOriginalChangeHandler<TDraft, TOriginal> {
  (
    oldOriginal: TOriginal | undefined,
    newOriginal: TOriginal | undefined,
    draft: TDraft,
    form: FormContext<TDraft, TOriginal>,
  ): TDraft | void;
}

export type OnOriginalChangeBuiltin = 'default' | 'merge' | 'overwrite';
export type OnOriginalChange<TDraft, TOriginal> =
  | OnOriginalChangeHandler<TDraft, TOriginal>
  | OnOriginalChangeBuiltin;

export function onOriginalChangeDefault<TDraft, TOriginal>(
  _oldOriginal: TOriginal | undefined,
  _newOriginal: TOriginal | undefined,
  draft: TDraft,
  _form: FormContext<TDraft, TOriginal>,
): TDraft | void {
  return draft;
}

export function onOriginalChangeMerge<TDraft, TOriginal>(
  oldOriginal: TOriginal | undefined,
  newOriginal: TOriginal | undefined,
  draft: TDraft,
  _form: FormContext<TDraft, TOriginal>,
): TDraft | void {
  const [patches] = diff(oldOriginal, newOriginal, { diffArrays: true });

  for (const p of patches) {
    const draftValue = get(draft, p.path as any);
    const oldValue = get(oldOriginal, p.path as any);

    if (deepEqual(draftValue, oldValue)) {
      switch (p.op) {
        case 'remove':
          draft = remove(draft, p.path as any);
          break;

        default:
          draft = set(draft, p.path as any, p.value);
          break;
      }
    }
  }

  return draft;
}

export function onOriginalChangeOverwrite<TDraft, TOriginal extends TDraft>(
  _oldOriginal: TOriginal | undefined,
  newOriginal: TOriginal | undefined,
  _draft: TDraft,
  _form: FormContext<TDraft, TOriginal>,
): TDraft | void {
  return newOriginal;
}

const builtinHandlers = {
  default: onOriginalChangeDefault,
  merge: onOriginalChangeMerge,
  overwrite: onOriginalChangeOverwrite,
};

export function resolveOnOriginalChange<TDraft, TOriginal>(
  onOriginalChange: OnOriginalChange<TDraft, TOriginal> | undefined,
): OnOriginalChangeHandler<TDraft, TOriginal> {
  if (typeof onOriginalChange === 'function') {
    return onOriginalChange;
  }

  if (typeof onOriginalChange === 'string' && onOriginalChange in builtinHandlers) {
    return builtinHandlers[onOriginalChange as OnOriginalChangeBuiltin] as OnOriginalChangeHandler<
      TDraft,
      TOriginal
    >;
  }

  return onOriginalChangeDefault;
}
