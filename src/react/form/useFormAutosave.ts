import type { Duration } from '@core';
import { calcDuration } from '@lib/calcDuration';
import { debounce } from '@lib/debounce';
import { queue } from '@lib/queue';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormContext } from './form';
import type { MaybePromise } from '@lib/maybePromise';

export interface FormAutosaveOptions<TDraft, TOriginal> {
  save: (draft: TDraft, form: FormContext<TDraft, TOriginal>) => MaybePromise<void>;
  debounce?: Duration;
}

export function useFormAutosave<TDraft, TOriginal extends TDraft>(
  form: FormContext<TDraft, TOriginal>,
) {
  const { formState, original, options, getDraft } = form;
  const debounceTime = calcDuration(options.autoSave?.debounce ?? 2_000);
  const latestRef = useRef({ options });
  const q = useMemo(() => queue(), []);
  const [isSaving, setIsSaving] = useState(false);

  const run = useMemo(
    () =>
      debounce(async () => {
        const { options } = latestRef.current;
        const save = options.autoSave?.save;

        q.clear();

        q(async () => {
          try {
            setIsSaving(true);
            await save?.(getDraft(), form);
          } finally {
            setIsSaving(false);
          }
        });
      }, debounceTime),
    [debounceTime],
  );

  useEffect(() => {
    if (!options.autoSave?.save) {
      return;
    }

    return formState.map((state) => state.draft).subscribe(run, { runNow: false });
  }, [formState]);

  useEffect(() => {
    latestRef.current = { options };
  });
}
