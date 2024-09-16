import type { Duration } from '@core';
import { calcDuration } from '@lib/calcDuration';
import { debounce } from '@lib/debounce';
import { deepEqual } from '@lib/equals';
import type { MaybePromise } from '@lib/maybePromise';
import { queue } from '@lib/queue';
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
  const { formState, options, getDraft } = form;
  const debounceTime = calcDuration(options.autoSave?.debounce ?? 2_000);
  const latestRef = useRef({ options });
  const lastValue = useRef<TDraft>();
  const q = useMemo(() => queue(), []);

  const run = useMemo(
    () =>
      debounce(async () => {
        const { options } = latestRef.current;
        const save = options.autoSave?.save;
        const draft = getDraft();

        lastValue.current = draft;

        q.clear();

        q(async () => {
          try {
            formState.set('saveInProgress', true);
            await save?.(draft, form);

            if (q.size === 0 && options.autoSave?.resetAfterSave) {
              form.reset();
            }
          } finally {
            formState.set('saveInProgress', false);

            if (q.size === 0) {
              formState.set('saveScheduled', false);
            }
          }
        });
      }, debounceTime),
    [formState, debounceTime],
  );

  useEffect(() => {
    if (!options.autoSave?.save) {
      return;
    }

    return formState
      .map((state) => state.draft)
      .subscribe(
        () => {
          if (deepEqual(getDraft(), lastValue.current)) {
            return;
          }

          run();
          formState.set('saveScheduled', true);
        },
        { runNow: false },
      );
  }, [formState]);

  useEffect(() => {
    latestRef.current = { options };
  });
}
