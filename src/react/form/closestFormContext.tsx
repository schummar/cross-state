import { type Form } from '@react/form/form';
import { createContext, useContext, type Context } from 'react';

export const GeneralFormContext: Context<Form<any, any> | null> = createContext<Form<
  any,
  any
> | null>(null);

export function useClosestForm<TDraft, TOriginal extends TDraft = TDraft>(): Form<
  TDraft,
  TOriginal
> | null {
  return useContext(GeneralFormContext) as Form<TDraft, TOriginal> | null;
}
