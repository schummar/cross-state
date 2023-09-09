import type { Duration } from '@core';
import type { FormContext, Form } from './form';
import { useCallback, useEffect, useMemo } from 'react';
import { calcDuration } from '@lib/calcDuration';
import { debounce } from '@lib/debounce';

export interface FormAutosaveOptions<TDraft, TOriginal> {
  save: (draft: TDraft, form: FormContext<TDraft, TOriginal>) => Promise<void>;
  debounce?: Duration;
}

export function useFormAutosave<TDraft, TOriginal extends TDraft>(
  form: Form<TDraft, TOriginal>,
  options: FormAutosaveOptions<TDraft, TOriginal>,
) {
  const { save } = options;
  const debounceTime = calcDuration(options.debounce ?? 2_000);
  const { formState, original } = form.useForm();

  const run = useMemo(() => debounce(async () => {}, debounceTime), [debounceTime]);

  useEffect(() => {}, [original]);
}
