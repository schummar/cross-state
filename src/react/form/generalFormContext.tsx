import { type FormContext } from '@react/form/form';
import { createContext, useContext, type Context } from 'react';

export const GeneralFormContext: Context<FormContext<any, any> | null> = createContext<FormContext<
  any,
  any
> | null>(null);

export function useForm<TDraft, TOriginal extends TDraft = TDraft>(): FormContext<
  TDraft,
  TOriginal
> | null {
  return useContext(GeneralFormContext) as FormContext<TDraft, TOriginal>;
}
