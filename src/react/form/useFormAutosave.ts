import type { Duration } from '@core';
import type { FormContext, Form } from './form';
import { useEffect } from 'react';

export interface FormAutosaveOptions<TDraft, TOriginal> {
  save: (draft: TDraft, form: FormContext<TDraft, TOriginal>) => Promise<void>;
  debounce?: Duration;
}

export function useFormAutosave<TDraft, TOriginal extends TDraft>(
  form: Form<TDraft, TOriginal>,
  options: FormAutosaveOptions<TDraft, TOriginal>,
) {
  const { formState } = form.useForm();

  useEffect(() => {}, []);
}
