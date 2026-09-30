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
import { deepEqual } from '@lib/equals';
import useLatestRef from '@react/lib/useLatestRef';
import useMemoEquals from '@react/lib/useMemoEquals';
import { create } from 'mutative';
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';

interface Autosave {
  flush(): Promise<void>;
  cancel(): Promise<void>;
}

export interface UseFormContextOptions<TDraft, TOriginal> {
  options: FormOptions<TDraft, TOriginal>;
  formRef: RefObject<HTMLFormElement | null>;
  initiallyTriggerValidations?: boolean;
  autosaveRef?: RefObject<Autosave | null>;
}

/**
 * Builds the form context: a stable core (store + methods) plus a per-render value carrying
 * the prop-driven inputs (`options`, `original`).
 *
 * The store only holds event-driven state. Prop-driven inputs must not be written into it:
 * during render that would notify subscribed children mid-render, in an effect it would leave
 * the first render stale. So methods read them from a ref that is updated during render.
 */
export function useFormContext<TDraft, TOriginal extends TDraft>({
  options,
  formRef,
  initiallyTriggerValidations,
  autosaveRef,
}: UseFormContextOptions<TDraft, TOriginal>): FormContext<TDraft, TOriginal> {
  const optionsRef = useLatestRef(options);
  const contextRef = useRef<FormContext<TDraft, TOriginal>>(null);
  // The original this context last reconciled its draft with.
  const lastOriginal = useRef(options.original);

  const { core, updateValidity } = useMemo(
    () =>
      createFormCore({
        optionsRef,
        formRef,
        autosaveRef,
        initiallyTriggerValidations,
      }),
    // oxlint-disable-next-line exhaustive-deps
    [],
  );
  const { formState } = core;

  const memoOptions = useMemoEquals(options, shallowEqual);

  const context = useMemo<FormContext<TDraft, TOriginal>>(
    () => ({ ...core, options: memoOptions, original: memoOptions.original }),
    [core, memoOptions],
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
        const { transform, original, defaultValue } = optionsRef.current;
        if (!transform) {
          return;
        }

        const value = draft ?? original ?? defaultValue;
        const previousValue = previousDraft ?? original ?? defaultValue;
        const result = create(value, (draft) =>
          transform(draft, { ...contextRef.current!, previousValue }),
        ) as TDraft;

        if (!deepEqual(result, value)) {
          formState.set('draft', result);
        }
      });
  }, [
    formState,
    optionsRef,
    memoOptions.transform,
    memoOptions.original,
    memoOptions.defaultValue,
  ]);

  // Layout effect so the merged draft is committed before paint.
  useLayoutEffect(() => {
    const draft = formState.get().draft;
    const { original, onOriginalChange } = optionsRef.current;

    if (draft !== undefined && !deepEqual(original, lastOriginal.current)) {
      const handler = resolveOnOriginalChange(onOriginalChange);
      const result = handler(lastOriginal.current, original, draft, contextRef.current!);

      if (result !== undefined && !deepEqual(result, draft)) {
        formState.set('draft', result);
      }
    }

    lastOriginal.current = original;
  }, [formState, optionsRef, memoOptions.original]);

  // Inputs mounted by a re-render need their validity applied too, not only error changes.
  useEffect(() => {
    updateValidity(core.getErrors());
  });

  useEffect(() => {
    return formState.map(() => core.getErrors()).subscribe((errors) => updateValidity(errors));
  }, [
    formState,
    core,
    updateValidity,
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
  initiallyTriggerValidations,
}: {
  optionsRef: RefObject<FormOptions<TDraft, TOriginal>>;
  formRef: RefObject<HTMLFormElement | null>;
  autosaveRef?: RefObject<Autosave | null>;
  initiallyTriggerValidations?: boolean;
}): {
  core: FormContext<TDraft, TOriginal>;
  updateValidity: (errors: Map<string, string[]>, buttonElement?: HTMLButtonElement) => void;
} {
  const formState = createStore<FormState<TDraft>>({
    draft: undefined,
    hasTriggeredValidations: initiallyTriggerValidations ?? false,
    saveInProgress: false,
  });

  // Pull-based memo shared by all consumers. Keyed on the draft identity and the prop-driven
  // inputs the derived values depend on, so it stays correct when e.g. `validations` change
  // without a draft change.
  let memo: { key: unknown[]; values: Map<string, unknown> } | undefined;

  function lazy<T>(name: string, fn: () => T): T {
    const { original, validations, localizeError, defaultValue } = optionsRef.current;
    const key = [formState.get().draft, original, validations, localizeError, defaultValue];

    if (!memo || memo.key.some((value, index) => value !== key[index])) {
      memo = { key, values: new Map() };
    }

    if (!memo.values.has(name)) {
      memo.values.set(name, fn());
    }

    return memo.values.get(name) as T;
  }

  function updateValidity(errors: Map<string, string[]>, buttonElement?: HTMLButtonElement) {
    const formElement = formRef.current;
    if (!formElement) {
      return;
    }

    for (const element of Array.from(formElement.elements)) {
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
  }

  const core: FormContext<TDraft, TOriginal> = {
    formState,

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
      const { original, defaultValue } = optionsRef.current;
      return formState.get().draft ?? original ?? defaultValue;
    },

    hasTriggeredValidations() {
      return formState.get().hasTriggeredValidations;
    },

    saveInProgress() {
      return formState.get().saveInProgress;
    },

    flushAutosave() {
      return autosaveRef?.current?.flush() ?? Promise.resolve();
    },

    cancelAutosave() {
      return autosaveRef?.current?.cancel() ?? Promise.resolve();
    },

    hasChanges() {
      return lazy('hasChanges', () => {
        const { original, defaultValue } = optionsRef.current;
        return !deepEqual(core.getDraft(), original ?? defaultValue, {
          undefinedEqualsAbsent: true,
        });
      });
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

  return { core, updateValidity };
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keysA = Object.keys(a) as (keyof T)[];
  const keysB = Object.keys(b);
  return keysA.length === keysB.length && keysA.every((key) => a[key] === b[key]);
}
