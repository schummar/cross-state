import type { Duration } from '@core';
import { calcDuration } from '@lib/calcDuration';
import { debounce } from '@lib/debounce';
import { deepEqual } from '@lib/equals';
import type { MaybePromise } from '@lib/maybePromise';
import { queue } from '@lib/queue';
import useLatestRef from '@react/lib/useLatestRef';
import { useEffect, useMemo, useRef } from 'react';
import type { FormContext } from './form';

export interface FormAutosaveOptions<TDraft, TOriginal> {
  save: (draft: TDraft, form: FormContext<TDraft, TOriginal>) => MaybePromise<void>;
  debounce?: Duration;
  resetAfterSave?: boolean;
}

export function useFormAutosave<TDraft, TOriginal extends TDraft>(
  form: FormContext<TDraft, TOriginal>,
): void {
  const debounceTime = calcDuration(form.options.autoSave?.debounce ?? 2_000);
  const latestRef = useLatestRef(form);
  const lastValue = useRef<TDraft | undefined>(undefined);
  const q = useMemo(() => queue(), []);

  const run = useMemo(
    () =>
      debounce(async () => {
        const save = latestRef.current.options.autoSave?.save;
        const draft = latestRef.current.getDraft();

        lastValue.current = draft;

        q.clear();

        q(async () => {
          try {
            latestRef.current.formState.set('saveInProgress', true);
            await save?.(draft, latestRef.current);

            if (q.size === 0 && latestRef.current.options.autoSave?.resetAfterSave) {
              latestRef.current.reset();
            }
          } finally {
            latestRef.current.formState.set('saveInProgress', false);

            if (q.size === 0) {
              latestRef.current.formState.set('saveScheduled', false);
            }
          }
        });
      }, debounceTime),
    [latestRef, debounceTime, q],
  );

  useEffect(() => {
    if (!latestRef.current.options.autoSave?.save) {
      return;
    }

    return latestRef.current.formState
      .map((state) => state.draft)
      .subscribe(
        () => {
          if (deepEqual(latestRef.current.getDraft(), lastValue.current)) {
            return;
          }

          run();
          latestRef.current.formState.set('saveScheduled', true);
        },
        { runNow: false },
      );
  }, [latestRef, run]);
}
