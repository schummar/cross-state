import { type Form, type FormContext, type FormOptions } from './form';
import { useFormContext, type OnApply } from './useFormContext';
import { useMemo, type ReactNode } from 'react';

export interface WorkingCopy<TDraft, TOriginal> {
  /**
   * The copy's form context. Hooks called directly in the `WorkingCopy` render function still
   * see the parent (they run in the copy component's own render), so use this instead.
   */
  form: FormContext<TDraft, TOriginal>;
  /**
   * Writes the copy's edits into the parent form and resets the copy. By default only the paths
   * the copy changed are written, so parent changes made elsewhere in the meantime survive.
   * Does not validate.
   */
  apply: () => void;
  /** Drops the copy's draft. Fields read through to the base again. */
  discard: () => void;
}

export interface FormWorkingCopyProps<TDraft, TOriginal> {
  /**
   * Replaces the default diff-and-patch on apply. Mutate `parentDraft` in place or return the
   * new parent draft. `form` is the copy's context.
   */
  onApply?: OnApply<TDraft, TOriginal>;
  children?: ReactNode | ((workingCopy: WorkingCopy<TDraft, TOriginal>) => ReactNode);
}

/**
 * Branches the form: edits inside land in a separate draft until `apply()`. The copy's base is a
 * snapshot of the parent draft taken at mount; later parent changes do not reach the copy.
 * `original` stays the real original.
 */
export function FormWorkingCopy<TDraft, TOriginal extends TDraft>(
  this: Form<TDraft, TOriginal>,
  { onApply, children }: FormWorkingCopyProps<TDraft, TOriginal>,
): React.JSX.Element {
  const parent = this.useForm();

  const options = useMemo(
    (): FormOptions<TDraft, TOriginal> => ({
      ...parent.options,
      autoSave: undefined,
      onSubmit: undefined,
    }),
    [parent.options],
  );

  const context = useFormContext({
    options,
    formRef: parent.formRef,
    initiallyTriggerValidations: parent.hasTriggeredValidations(),
    parent,
    onApply,
  });

  return (
    <this.context.Provider value={context}>
      {typeof children === 'function' ? children(context.workingCopy!) : children}
    </this.context.Provider>
  );
}
