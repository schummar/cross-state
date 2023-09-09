import { type Form } from './form';
import { type PathAsString } from '@lib/path';

export type FormErrorProps<TDraft, TPath extends PathAsString<TDraft>> = {
  name: TPath;
};

export function FormError<TDraft, TPath extends PathAsString<TDraft>>(
  this: Form<TDraft, any>,
  { name }: FormErrorProps<TDraft, TPath>,
) {
  const hasTriggeredValidations = this.useFormState((form) => form.hasTriggeredValidations);
  const { errors } = this.useField(name);

  return hasTriggeredValidations ? <>{errors.join(', ')}</> : null;
}
