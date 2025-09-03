import { type PathAsString, type Value } from '@lib/path';
import {
  createElement,
  useEffect,
  useState,
  type Component,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import {
  getDerivedState,
  type Field,
  type Form,
  type FormContext,
  type FormInstance,
} from './form';

export interface FormFieldComponentProps<TValue, TPath> {
  name: TPath;
  value: TValue;
  onChange: (event: { target: { value: TValue } } | TValue | undefined, ...args: any[]) => void;
  onBlur: (...args: any[]) => void;
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

export type FormFieldProps<TPath, TDraft> = {
  name: TPath & PathAsString<TDraft>;
  commitOnBlur?: boolean;
  commitDebounce?: number;
};

export type FormFieldPropsWithRender<TDraft, TOriginal, TPath extends string> = FormFieldProps<
  TPath,
  TDraft
> &
  NoInfer<{
    component?: undefined;
    render: (
      props: FormFieldComponentProps<Value<TDraft, TPath>, TPath>,
      info: FormFieldInfos<TDraft, TOriginal, TPath>,
      form: FormContext<TDraft, TOriginal>,
    ) => ReactNode;
    inputFilter?: undefined;
    defaultValue?: undefined;
    serialize?: undefined;
    deserialize?: undefined;
    onChange?: undefined;
    onBlur?: undefined;
  }>;

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
  component?: TComponent;
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

export function FormField<
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
    render,
    inputFilter,
    defaultValue,
    serialize,
    deserialize = (x) => x as Value<TDraft, TPath>,
    onChange,
    onBlur,
    ...restProps
  }:
    | FormFieldPropsWithRender<TDraft, TOriginal, TPath>
    | FormFieldPropsWithComponent<TDraft, TOriginal, TPath, TComponent>,
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

  const setValue = (x: FieldChangeValue<TComponent>) =>
    form.getField(name as any).setValue(deserialize(x, getFormState()));

  const hasTriggeredValidations = this.useFormState((form) => form.hasTriggeredValidations);

  useEffect(() => {
    if (localValue === undefined || !commitDebounce) {
      return;
    }

    const timeout = setTimeout(() => {
      setValue(localValue);
      setLocalValue(undefined);
    }, commitDebounce);

    return () => clearTimeout(timeout);
  }, [localValue, commitDebounce]);

  const props = {
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

  if (render) {
    return (
      <>
        {render(props, { ...form.getField(name as any), hasTriggeredValidations } as any, form) ??
          null}
      </>
    );
  }

  if (component) {
    return createElement(component, { ...restProps, ...props });
  }

  return null;
}
