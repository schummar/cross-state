import { type Form, type FormContext, type FormOptions } from './form';
import { useFormContext, type OnApply } from './useFormContext';
import { useImperativeHandle, useMemo, type ForwardedRef, type ReactNode } from 'react';

export interface WorkingCopy<TDraft, TOriginal> extends FormContext<TDraft, TOriginal> {
  parent: FormContext<TDraft, TOriginal>;
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
  /**
   * Hooks called directly in a render function still see the parent (they run in the copy
   * component's own render), so use its argument instead.
   */
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
  ref: ForwardedRef<WorkingCopy<TDraft, TOriginal>>,
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

  const workingCopy = context as WorkingCopy<TDraft, TOriginal>;
  useImperativeHandle(ref, () => workingCopy, [workingCopy]);

  return (
    <this.context.Provider value={workingCopy}>
      {typeof children === 'function' ? children(workingCopy) : children}
    </this.context.Provider>
  );
}

export function isWorkingCopy<TDraft, TOriginal>(
  form: FormContext<TDraft, TOriginal>,
): form is WorkingCopy<TDraft, TOriginal> {
  return form.parent !== undefined;
}
