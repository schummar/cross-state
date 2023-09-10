import type { Duration } from '@core';
import { calcDuration } from '@lib/calcDuration';
import { debounce } from '@lib/debounce';
import { queue } from '@lib/queue';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormContext } from './form';
import type { MaybePromise } from '@lib/maybePromise';
import { deepEqual } from '@lib/equals';

export interface FormAutosaveOptions<TDraft, TOriginal> {
  save: (draft: TDraft, form: FormContext<TDraft, TOriginal>) => MaybePromise<void>;
  debounce?: Duration;
  resetAfterSave?: boolean;
}

export function useFormAutosave<TDraft, TOriginal extends TDraft>(
  form: FormContext<TDraft, TOriginal>,
) {
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

        if (deepEqual(draft, lastValue.current)) {
          return;
        }

        lastValue.current = draft;

        q.clear();

        q(async () => {
          try {
            formState.set('saveInProgress', true);
            await save?.(getDraft(), form);

            if (q.length === 0 && options.autoSave?.resetAfterSave) {
              form.reset();
            }
          } finally {
            formState.set('saveInProgress', false);

            if (q.length === 0) {
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
