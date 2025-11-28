import type { Duration } from '@core';
import { calcDuration } from '@lib/duration';
import { type PathAsString, type Value } from '@lib/path';
import useLatestFunction from '@react/lib/useLatestFunction';
import { useEffect, useState, type Component, type ReactNode } from 'react';
import { Form, type Field, type FormContext } from './form';

export interface FormFieldComponentProps<TValue, TPath> {
  name: TPath;
  value: TValue;
  onChange: (event: { target: { value: TValue } } | TValue | undefined, ...args: any[]) => void;
  onBlur: (...args: any[]) => void;
  'data-invalid'?: boolean;
}

export type FormFieldInfos<TDraft, TOriginal, TPath extends string> = Field<
  TDraft,
  TOriginal,
  TPath
> & {
  hasTriggeredValidations: boolean;
};

type NativeInputType = 'input' | 'select' | 'textarea';

type PartialComponentType<P> =
  | (new (props: P, context?: any) => Component<P, any>)
  | ((props: P, context?: any) => ReactNode);

export type FormFieldComponent = NativeInputType | PartialComponentType<any>;

export interface FormFieldProps<TPath, TDraft> {
  name: TPath & PathAsString<TDraft>;
  commitOnBlur?: boolean;
  commitDebounce?: Duration;
}

export interface FormFieldPropsWithRender<TDraft, TOriginal, TPath extends string>
  extends FormFieldProps<TPath, TDraft> {
  component?: undefined;
  render: NoInfer<
    (
      props: FormFieldComponentProps<Value<TDraft, TPath>, TPath>,
      info: FormFieldInfos<TDraft, TOriginal, TPath>,
      form: FormContext<TDraft, TOriginal>,
    ) => ReactNode
  >;
  children?: undefined;
  inputFilter?: undefined;
  defaultValue?: undefined;
  serialize?: undefined;
  deserialize?: undefined;
  onChange?: undefined;
  onBlur?: undefined;
}

export interface FormFieldPropsWithChildren<TDraft, TOriginal, TPath extends string>
  extends FormFieldProps<TPath, TDraft> {
  component?: undefined;
  render?: undefined;
  children: NoInfer<
    (
      props: FormFieldComponentProps<Value<TDraft, TPath>, TPath>,
      info: FormFieldInfos<TDraft, TOriginal, TPath>,
      form: FormContext<TDraft, TOriginal>,
    ) => ReactNode
  >;
  inputFilter?: undefined;
  defaultValue?: undefined;
  serialize?: undefined;
  deserialize?: undefined;
  onChange?: undefined;
  onBlur?: undefined;
}

export function FormField<TDraft, TOriginal extends TDraft, TPath extends string>(
  this: Form<TDraft, any>,
  {
    name = '' as any,
    commitOnBlur,
    commitDebounce,
    children,
    render = children,
  }:
    | FormFieldPropsWithRender<TDraft, TOriginal, TPath>
    | FormFieldPropsWithChildren<TDraft, TOriginal, TPath>,
): React.JSX.Element | null {
  const form = this.useForm();
  const field = this.useField(name);
  const hasTriggeredValidations = this.useFormState((form) => form.hasTriggeredValidations);

  const renderProps = useFormFieldProps.call<
    Form<TDraft, TOriginal>,
    [FormFieldProps<TPath, TDraft>],
    FormFieldComponentProps<Value<TDraft, TPath>, TPath>
  >(this, {
    name,
    commitOnBlur,
    commitDebounce,
  });

  if (render) {
    return <>{render(renderProps, { ...field, hasTriggeredValidations } as any, form)}</>;
  }

  return null;
}

export function useFormFieldProps<TDraft, TPath extends string>(
  this: Form<TDraft, any>,
  { name = '' as any, commitOnBlur, commitDebounce }: FormFieldProps<TPath, TDraft>,
): FormFieldComponentProps<Value<TDraft, TPath>, TPath> {
  type T = Value<TDraft, TPath>;

  const form = this.useForm();
  const field = this.useField(name);
  const hasTriggeredValidations = this.useFormState((form) => form.hasTriggeredValidations);
  const [localValue, setLocalValue] = useState<T>();

  const commitDebounceMs = commitDebounce !== undefined ? calcDuration(commitDebounce) : undefined;

  const commitLocalValue = useLatestFunction(() => {
    field.setValue(localValue as any);
    setLocalValue(undefined);
  });

  useEffect(() => {
    if (localValue === undefined || commitDebounceMs === undefined || commitDebounceMs <= 0) {
      return;
    }

    const timeout = setTimeout(commitLocalValue, commitDebounceMs);
    return () => clearTimeout(timeout);
  }, [localValue, commitDebounceMs, commitLocalValue]);

  let props = {
    name,
    value: localValue ?? field.value,
    onChange: useLatestFunction((event: { target: { value: T } } | T) => {
      const value =
        typeof event === 'object' && event !== null && 'target' in event
          ? event.target.value
          : event;

      if (commitOnBlur || (commitDebounceMs !== undefined && commitDebounceMs > 0)) {
        setLocalValue(value);
      } else {
        field.setValue(value as any);
      }
    }),
    onBlur: useLatestFunction(() => {
      if (localValue !== undefined) {
        commitLocalValue();
      }
    }),
    'data-invalid': field.errors.length > 0,
  } as FormFieldComponentProps<Value<TDraft, TPath>, TPath>;

  if (this.options.transformFieldProps) {
    props = this.options.transformFieldProps(
      props,
      { ...field, hasTriggeredValidations } as any,
      form,
    );
  }

  return props;
}
