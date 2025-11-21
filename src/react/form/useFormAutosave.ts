import type { Duration } from '@core';
import { debounce } from '@lib/debounce';
import { calcDuration } from '@lib/duration';
import type { MaybePromise } from '@lib/maybePromise';
import { queue } from '@lib/queue';
import useLatestFunction from '@react/lib/useLatestFunction';
import { useEffect, useMemo, useRef } from 'react';
import type { FormContext } from './form';
import { deepEqual } from '@lib/equals';

export interface FormAutosaveOptions<TDraft, TOriginal> {
  save: (draft: TDraft, prev: TDraft, form: FormContext<TDraft, TOriginal>) => MaybePromise<void>;
  debounce?: Duration;
  resetAfterSave?: boolean;
}

export function useFormAutosave<TDraft, TOriginal extends TDraft>(
  form: FormContext<TDraft, TOriginal>,
): {
  flush(): Promise<void>;
  cancel(): Promise<void>;
} {
  const isActive = !!form.options.autoSave;
  const debounceTime = calcDuration(form.options.autoSave?.debounce ?? 2_000);
  const prev = useRef(form.getDraft());
  const q = useMemo(() => queue(), []);

  const latestSave = useLatestFunction(async () => {
    const draft = form.getDraft();

    if (deepEqual(draft, prev.current, { undefinedEqualsAbsent: true })) {
      return;
    }

    form.formState.set('saveInProgress', true);

    try {
      await form.options.autoSave?.save?.(draft, prev.current, form);
      prev.current = draft;

      if (q.size === 0 && form.options.autoSave?.resetAfterSave) {
        form.reset();
      }
    } catch (error) {
      console.error('Unhandled error during form autosave:', error);
    } finally {
      form.formState.set('saveInProgress', false);
    }
  });

  const scheduleSave = useMemo(
    () =>
      debounce(() => {
        q.clear();
        q(latestSave);
      }, debounceTime),
    [q, latestSave, debounceTime],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }

    return form.formState
      .map((state) => state.draft)
      .subscribe(
        (draft) => {
          if (draft === undefined) {
            return;
          }

          scheduleSave();
        },
        {
          runNow: false,
        },
      );
  }, [isActive, form.formState, scheduleSave]);

  return {
    flush() {
      scheduleSave.flush();
      return q.whenDone();
    },
    cancel() {
      scheduleSave.cancel();
      return q.whenDone();
    },
  };
}
