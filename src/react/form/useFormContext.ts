import {
  getErrors,
  getField,
  type FieldOptions,
  type FormContext,
  type FormOptions,
  type FormState,
  type ValidateOptions,
} from './form';
import { resolveOnOriginalChange } from './formOnOriginalChange';
import { createStore } from '@core';
import { applyPatches } from '@lib/applyPatches';
import { diff } from '@lib/diff';
import { deepEqual } from '@lib/equals';
import useLatestRef from '@react/lib/useLatestRef';
import useMemoEquals from '@react/lib/useMemoEquals';
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';

interface Autosave {
  flush(): Promise<void>;
  cancel(): Promise<void>;
}

type UpdateValidity = (
  errors: Map<string, string[]>,
  buttonElement?: HTMLButtonElement,
  options?: { onlyUnseen?: boolean; skipIfUnchanged?: boolean },
) => void;

export interface UseFormContextOptions<TDraft, TOriginal> {
  options: FormOptions<TDraft, TOriginal>;
  formRef: RefObject<HTMLFormElement | null>;
  initiallyTriggerValidations?: boolean;
  autosaveRef?: RefObject<Autosave | null>;
  /** Makes this context a working copy of `parent`. */
  parent?: FormContext<TDraft, TOriginal>;
  /** Working copy only: replaces the default diff-and-patch apply. */
  onApply?: OnApply<TDraft, TOriginal>;
}

/**
 * Returns the new parent draft, or nothing to leave it as is (e.g. after updating fields through
 * `form.parent`). Do not mutate the arguments.
 */
export type OnApply<TDraft, TOriginal> = (
  workingDraft: TDraft,
  parentDraft: TDraft,
  form: FormContext<TDraft, TOriginal>,
) => TDraft | void;

/**
 * Builds the form context: a stable core (store + methods) plus a per-render value carrying
 * the prop-driven inputs (`options`, `original`).
 *
 * The store only holds event-driven state. Prop-driven inputs must not be written into it:
 * during render that would notify subscribed children mid-render, in an effect it would leave
 * the first render stale. So methods read them from a ref that is updated during render.
 *
 * The draft's *base* is what an untouched form reads through to and what `hasChanges` compares
 * against: `original ?? defaultValue` for a root form, a snapshot of the parent draft taken at
 * mount (and after each apply) for a working copy. `original` always stays the real original.
 */
export function useFormContext<TDraft, TOriginal extends TDraft>({
  options,
  formRef,
  initiallyTriggerValidations,
  autosaveRef,
  parent,
  onApply,
}: UseFormContextOptions<TDraft, TOriginal>): FormContext<TDraft, TOriginal> {
  const optionsRef = useLatestRef(options);
  const parentRef = useLatestRef(parent);
  const onApplyRef = useLatestRef(onApply);
  const contextRef = useRef<FormContext<TDraft, TOriginal>>(null);

  const memoOptions = useMemoEquals(options, shallowEqual);

  const { core, updateValidity, getBase } = useMemo(
    () =>
      createFormCore({
        optionsRef,
        formRef,
        autosaveRef,
        parentRef,
        onApplyRef,
        contextRef,
        initiallyTriggerValidations,
      }),
    // oxlint-disable-next-line exhaustive-deps
    [],
  );
  const { formState } = core;

  const context = useMemo<FormContext<TDraft, TOriginal>>(
    () => ({
      ...core,
      options: memoOptions,
      original: memoOptions.original,
      parent,
      workingCopy: core.workingCopy && {
        ...core.workingCopy,
        get form() {
          return contextRef.current!;
        },
      },
    }),
    [core, memoOptions, parent],
  );
  contextRef.current = context;

  useEffect(() => {
    if (!memoOptions.transform) {
      return;
    }

    // Resubscribing (runNow) on original/defaultValue changes keeps an untouched form's draft
    // transformed when its base changes.
    return formState
      .map((state) => state.draft)
      .subscribe((draft, previousDraft) => {
        const { transform } = optionsRef.current;
        if (!transform) {
          return;
        }

        const value = draft ?? getBase();
        const previousValue = previousDraft ?? getBase();
        const result = transform(value, { ...contextRef.current!, previousValue });

        if (result !== undefined && !deepEqual(result, value)) {
          formState.set('draft', result);
        }
      });
  }, [
    formState,
    optionsRef,
    getBase,
    memoOptions.transform,
    memoOptions.original,
    memoOptions.defaultValue,
  ]);

  const isWorkingCopy = !!parent;
  const lastOriginal = useRef(options.original);

  // Root form only: a working copy's base is frozen. Layout effect so the merged draft is
  // committed before paint.
  useLayoutEffect(() => {
    const draft = formState.get().draft;
    const { original, onOriginalChange } = optionsRef.current;

    if (!isWorkingCopy && draft !== undefined && !deepEqual(original, lastOriginal.current)) {
      const handler = resolveOnOriginalChange(onOriginalChange);
      const result = handler(lastOriginal.current, original, draft, contextRef.current!);

      if (result !== undefined && !deepEqual(result, draft)) {
        formState.set('draft', result);
      }
    }

    lastOriginal.current = original;
  }, [formState, optionsRef, isWorkingCopy, memoOptions.original]);

  // Inputs mounted by a re-render need their validity applied too, not only error changes. Only
  // unseen elements are written so a root re-render does not clobber what a validated working
  // copy wrote to its inputs.
  useEffect(() => {
    if (!isWorkingCopy) {
      updateValidity(core.getErrors(), undefined, { onlyUnseen: true });
    }
  });

  useEffect(() => {
    const parent = parentRef.current;

    if (parent) {
      // A copy shares the parent's <form> element. It only writes its errors once validate() was
      // called (then it keeps them live); on unmount the parent's validity is restored.
      const cancel = formState
        .map((state) => (state.hasTriggeredValidations ? core.getErrors() : undefined))
        .subscribe((errors) => errors && updateValidity(errors));

      return () => {
        cancel();
        updateValidity(parent.getErrors());
      };
    }

    return formState
      .map(() => core.getErrors())
      .subscribe((errors) => updateValidity(errors, undefined, { skipIfUnchanged: true }));
  }, [
    formState,
    core,
    updateValidity,
    parentRef,
    memoOptions.validations,
    memoOptions.localizeError,
    memoOptions.original,
    memoOptions.defaultValue,
  ]);

  return context;
}

function createFormCore<TDraft, TOriginal extends TDraft>({
  optionsRef,
  formRef,
  autosaveRef,
  parentRef,
  onApplyRef,
  contextRef,
  initiallyTriggerValidations,
}: {
  optionsRef: RefObject<FormOptions<TDraft, TOriginal>>;
  formRef: RefObject<HTMLFormElement | null>;
  autosaveRef?: RefObject<Autosave | null>;
  parentRef: RefObject<FormContext<TDraft, TOriginal> | undefined>;
  onApplyRef: RefObject<OnApply<TDraft, TOriginal> | undefined>;
  contextRef: RefObject<FormContext<TDraft, TOriginal> | null>;
  initiallyTriggerValidations?: boolean;
}): {
  core: FormContext<TDraft, TOriginal>;
  updateValidity: UpdateValidity;
  getBase: () => TDraft;
} {
  const formState = createStore<FormState<TDraft>>({
    draft: undefined,
    hasTriggeredValidations: initiallyTriggerValidations ?? false,
    saveInProgress: false,
  });

  // A working copy's base: the parent draft frozen at mount, replaced on apply.
  let copyBase = parentRef.current?.getDraft();

  function getBase(): TDraft {
    if (copyBase !== undefined) {
      return copyBase;
    }

    const { original, defaultValue } = optionsRef.current;
    return original ?? defaultValue;
  }

  // Pull-based memo shared by all consumers. Keyed on the draft identity and the prop-driven
  // inputs the derived values depend on, so it stays correct when e.g. `validations` change
  // without a draft change.
  let memo: { key: unknown[]; values: Map<string, unknown> } | undefined;

  function lazy<T>(name: string, fn: () => T): T {
    const { original, validations, localizeError } = optionsRef.current;
    const key = [formState.get().draft, getBase(), original, validations, localizeError];

    if (!memo || memo.key.some((value, index) => value !== key[index])) {
      memo = { key, values: new Map() };
    }

    if (!memo.values.has(name)) {
      memo.values.set(name, fn());
    }

    return memo.values.get(name) as T;
  }

  const seenElements = new WeakSet<Element>();
  let lastFullWrite: Map<string, string[]> | undefined;

  const updateValidity: UpdateValidity = (
    errors,
    buttonElement,
    { onlyUnseen, skipIfUnchanged } = {},
  ) => {
    const formElement = formRef.current;
    if (!formElement) {
      return;
    }

    // Resubscribing on a prop identity change must not re-write unchanged errors over what a
    // validated working copy wrote to its inputs.
    if (skipIfUnchanged && lastFullWrite && deepEqual(errors, lastFullWrite)) {
      return;
    }

    if (!onlyUnseen) {
      lastFullWrite = errors;
    }

    for (const element of Array.from(formElement.elements)) {
      if (onlyUnseen && seenElements.has(element)) {
        continue;
      }

      seenElements.add(element);

      if ('name' in element && 'setCustomValidity' in element) {
        (element as HTMLObjectElement).setCustomValidity(
          errors.get((element as HTMLObjectElement).name)?.join('\n') ?? '',
        );
      }
    }

    if (buttonElement && 'setCustomValidity' in buttonElement) {
      const errorString = [...errors.values()].flat().join('\n');

      buttonElement.setCustomValidity(errorString);
    }
  };

  const core: FormContext<TDraft, TOriginal> = {
    formState,
    formRef,

    get options() {
      return optionsRef.current;
    },

    get original() {
      return optionsRef.current.original;
    },

    getField(path, fieldOptions?: FieldOptions) {
      return lazy(`${path as string}:${fieldOptions?.includeNestedErrors}`, () =>
        getField(core, path, fieldOptions),
      );
    },

    getDraft() {
      return formState.get().draft ?? getBase();
    },

    hasTriggeredValidations() {
      return formState.get().hasTriggeredValidations;
    },

    saveInProgress() {
      return formState.get().saveInProgress;
    },

    flushAutosave() {
      return (
        autosaveRef?.current?.flush() ?? parentRef.current?.flushAutosave() ?? Promise.resolve()
      );
    },

    cancelAutosave() {
      return (
        autosaveRef?.current?.cancel() ?? parentRef.current?.cancelAutosave() ?? Promise.resolve()
      );
    },

    hasChanges() {
      return lazy(
        'hasChanges',
        () => !deepEqual(core.getDraft(), getBase(), { undefinedEqualsAbsent: true }),
      );
    },

    getErrors() {
      return lazy('getErrors', () => getErrors(core.getDraft(), optionsRef.current));
    },

    isValid() {
      return lazy('isValid', () => core.getErrors().size === 0);
    },

    validate({ reportValidity = optionsRef.current.reportValidity, button }: ValidateOptions = {}) {
      formState.set('hasTriggeredValidations', true);

      updateValidity(core.getErrors(), button);

      switch (reportValidity) {
        case 'browser':
          formRef.current?.reportValidity();
          break;

        case true:
        case 'scrollTo':
          {
            const invalidElement = document.querySelector(':invalid, [data-invalid="true"]');
            if (invalidElement && invalidElement instanceof HTMLElement) {
              invalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              invalidElement.focus({ preventScroll: true });
            }
          }
          break;
      }

      return core.isValid();
    },

    reset() {
      formState.set('draft', undefined);
      formState.set('hasTriggeredValidations', false);
    },
  };

  if (parentRef.current) {
    core.workingCopy = {
      get form() {
        return core;
      },

      apply() {
        const parent = parentRef.current!;
        const draft = formState.get().draft;
        const onApply = onApplyRef.current;

        if (draft !== undefined) {
          // By default only the copy's own edits are written: patches from the frozen base,
          // applied to the live parent draft, so parent changes elsewhere survive. No patches →
          // don't touch the parent: materialising its draft would stop it following later
          // original changes.
          if (onApply) {
            const result = onApply(draft, parent.getDraft(), contextRef.current!);

            if (result !== undefined) {
              parent.formState.set('draft', result);
            }
          } else {
            const patches = diff(copyBase, draft, { diffArrays: true })[0];

            if (patches.length > 0) {
              parent.formState.set('draft', (parentDraft = parent.getDraft()) =>
                applyPatches(parentDraft, ...patches),
              );
            }
          }

          copyBase = parent.getDraft();
        }

        core.reset();
      },

      discard() {
        core.reset();
        updateValidity(parentRef.current!.getErrors());
      },
    };
  }

  return { core, updateValidity, getBase };
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keysA = Object.keys(a) as (keyof T)[];
  const keysB = Object.keys(b);
  return keysA.length === keysB.length && keysA.every((key) => a[key] === b[key]);
}
