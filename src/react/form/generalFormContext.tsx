import { type FormContext } from '@react/form/form';
import { createContext, useContext, type Context } from 'react';

export const GeneralFormContext: Context<FormContext<any, any> | null> = createContext<FormContext<
  any,
  any
> | null>(null);

export function useForm<TDraft, TOriginal extends TDraft = TDraft>(): FormContext<
  TDraft,
  TOriginal
> {
  const context = useContext(GeneralFormContext) as FormContext<TDraft, TOriginal>;

  if (!context) {
    throw new Error('useForm must be used within a FormContext');
  }

  return context;
}
