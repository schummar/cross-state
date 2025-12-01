import { calcDuration } from '@lib/duration';
import type { Value } from '@lib/path';
import { getDerivedState, type Form, type FormInstance } from '@react/form/form';
import type {
  FormFieldComponent,
  FormFieldComponentProps,
  FormFieldProps,
} from '@react/form/formField';
import useLatestFunction from '@react/lib/useLatestFunction';
import { createElement, useEffect, useState, type ComponentPropsWithoutRef } from 'react';

type FieldValue<T extends FormFieldComponent> = ComponentPropsWithoutRef<T>['value'];

type FieldChangeValue<T extends FormFieldComponent> =
  ComponentPropsWithoutRef<T> extends {
    onChange?: (update: infer U) => void;
  }
    ? U extends { target: { value: infer V } }
      ? V
      : U
    : never;

type MakeOptional<T, Keys extends string> = Omit<T, Keys> & Partial<Pick<T, Keys & keyof T>>;

type Serialize<TDraft, TOriginal, TPath, TComponent extends FormFieldComponent> = (
  value: Value<TDraft, TPath>,
  formState: FormInstance<TDraft, TOriginal>,
) => FieldValue<TComponent>;

type Deserialize<TDraft, TOriginal, TPath, TComponent extends FormFieldComponent> = (
  value: FieldChangeValue<TComponent>,
  formState: FormInstance<TDraft, TOriginal>,
) => Value<TDraft, TPath>;

export type FormFieldPropsWithComponent<
  TDraft,
  TOriginal,
  TPath extends string,
  TComponent extends FormFieldComponent,
> = FormFieldProps<TPath, TDraft> & {
  component: TComponent;
  render?: undefined;
} & NoInfer<
    {
      inputFilter?: (value: FieldChangeValue<TComponent>) => boolean;
    } & MakeOptional<
      Omit<ComponentPropsWithoutRef<TComponent>, 'id' | 'name' | 'value' | 'defaultValue'>,
      'onChange' | 'onBlur'
    > &
      (Value<TDraft, TPath> extends Exclude<FieldValue<TComponent>, undefined>
        ? {
            defaultValue?: FieldValue<TComponent>;
            serialize?: Serialize<TDraft, TOriginal, TPath, TComponent>;
          }
        : Value<TDraft, TPath> extends FieldValue<TComponent>
          ?
              | {
                  defaultValue: FieldValue<TComponent>;
                  serialize?: Serialize<TDraft, TOriginal, TPath, TComponent>;
                }
              | {
                  defaultValue?: FieldValue<TComponent>;
                  serialize: Serialize<TDraft, TOriginal, TPath, TComponent>;
                }
          : {
              serialize: Serialize<TDraft, TOriginal, TPath, TComponent>;
            }) &
      (FieldChangeValue<TComponent> extends Value<TDraft, TPath>
        ? {
            deserialize?: Deserialize<TDraft, TOriginal, TPath, TComponent>;
          }
        : {
            deserialize: Deserialize<TDraft, TOriginal, TPath, TComponent>;
          })
  >;

export function LegacyFormField<
  TDraft,
  TOriginal,
  TPath extends string,
  TComponent extends FormFieldComponent,
>(
  this: Form<TDraft, any>,
  {
    // id,
    name = '' as any,
    component,
    commitOnBlur,
    commitDebounce,
    inputFilter,
    defaultValue,
    serialize,
    deserialize = (x) => x as Value<TDraft, TPath>,
    onChange,
    onBlur,
    ...restProps
  }: FormFieldPropsWithComponent<TDraft, TOriginal, TPath, TComponent>,
): React.JSX.Element | null {
  type T = FieldChangeValue<TComponent>;

  const form = this.useForm();
  const getFormState = () => ({ ...form, ...getDerivedState(form) });
  const [localValue, setLocalValue] = useState<T>();

  const value = this.useFormState((form) => {
    const value = form.getField(name as any).value;
    if (serialize) {
      return serialize(value as any, getFormState());
    }
    if (value !== undefined) {
      return value;
    }
    return defaultValue;
  });

  const setValue = useLatestFunction((x: FieldChangeValue<TComponent>) =>
    form.getField(name as any).setValue(deserialize(x, getFormState())),
  );

  const hasTriggeredValidations = this.useFormState((form) => form.hasTriggeredValidations);

  const commitDebounceMs = commitDebounce !== undefined ? calcDuration(commitDebounce) : undefined;
  useEffect(() => {
    if (localValue === undefined || commitDebounceMs === undefined || commitDebounceMs <= 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setValue(localValue);
      setLocalValue(undefined);
    }, commitDebounceMs);

    return () => clearTimeout(timeout);
  }, [localValue, commitDebounceMs, setValue]);

  let props = {
    name,
    value: localValue ?? value,
    onChange: (event: { target: { value: T } } | T, ...moreArgs: any[]) => {
      const value =
        typeof event === 'object' && event !== null && 'target' in event
          ? event.target.value
          : event;

      if (inputFilter && !inputFilter(value)) {
        return;
      }

      if (commitOnBlur || commitDebounce) {
        setLocalValue(value);
      } else {
        setValue(value);
      }

      onChange?.(event, ...moreArgs);
    },
    onBlur(...args: any[]) {
      if (localValue !== undefined) {
        setValue(localValue);
        setLocalValue(undefined);
      }

      onBlur?.(...args);
    },
  } as FormFieldComponentProps<Value<TDraft, TPath>, TPath>;

  if (this.options.transformFieldProps) {
    props = this.options.transformFieldProps(
      props,
      { ...form.getField(name as any), hasTriggeredValidations } as any,
      form,
    );
  }

  if (component) {
    return createElement(component, { ...restProps, ...props });
  }

  return null;
}
