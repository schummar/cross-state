import { type PathAsString } from '@index';
import { type Value } from '@lib/path';
import {
  createElement,
  useEffect,
  useMemo,
  useState,
  type Component,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { type Form } from './form';

export interface FormFieldComponentProps<TValue, TPath> {
  name: TPath;
  value: TValue;
  onChange: (event: { target: { value: TValue } } | TValue | undefined, ...args: any[]) => void;
  onBlur: (...args: any[]) => void;
}

type NativeInputType = 'input' | 'select' | 'textarea';

type PartialComponentType<P> =
  | (new (props: P, context?: any) => Component<P, any>)
  | ((props: P, context?: any) => ReactNode);

export type FormFieldComponent = NativeInputType | PartialComponentType<any>;

type FieldValue<T extends FormFieldComponent> = ComponentPropsWithoutRef<T>['value'];

type FieldChangeValue<T extends FormFieldComponent> = ComponentPropsWithoutRef<T> extends {
  onChange?: (update: infer U) => void;
}
  ? U extends { target: { value: infer V } }
    ? V
    : U
  : never;

type MakeOptional<T, Keys extends string> = Omit<T, Keys> & Partial<Pick<T, Keys & keyof T>>;

export type FormFieldProps<TDraft, TPath extends PathAsString<TDraft>> = {
  name: TPath;
  commitOnBlur?: boolean;
  commitDebounce?: number;
};

export type FormFieldPropsWithRender<TDraft, TPath extends PathAsString<TDraft>> = FormFieldProps<
  TDraft,
  TPath
> & {
  component?: undefined;
  render: (props: FormFieldComponentProps<Value<TDraft, TPath>, TPath>) => ReactNode;
  inputFilter?: undefined;
  serialize?: undefined;
  deserialize?: undefined;
  onChange?: undefined;
  onBlur?: undefined;
};

export type FormFieldPropsWithComponent<
  TDraft,
  TPath extends PathAsString<TDraft>,
  TComponent extends FormFieldComponent,
> = FormFieldProps<TDraft, TPath> & {
  component?: TComponent;
  render?: undefined;
  inputFilter?: (value: FieldChangeValue<TComponent>) => boolean;
} & MakeOptional<
    Omit<ComponentPropsWithoutRef<TComponent>, 'id' | 'name' | 'value'>,
    'onChange' | 'onBlur'
  > &
  (Value<TDraft, TPath> extends FieldValue<TComponent>
    ? { serialize?: (value: Value<TDraft, TPath>) => FieldValue<TComponent> }
    : { serialize: (value: Value<TDraft, TPath>) => FieldValue<TComponent> }) &
  (FieldChangeValue<TComponent> extends Value<TDraft, TPath>
    ? { deserialize?: (value: FieldChangeValue<TComponent>) => Value<TDraft, TPath> }
    : { deserialize: (value: FieldChangeValue<TComponent>) => Value<TDraft, TPath> });

export function FormField<
  TDraft,
  TPath extends PathAsString<TDraft>,
  TComponent extends FormFieldComponent,
>(
  this: Form<TDraft, any>,
  {
    // id,
    name,
    component,
    commitOnBlur,
    commitDebounce,
    render,
    inputFilter,
    serialize = (x) => x as FieldValue<TComponent>,
    deserialize = (x) => x as Value<TDraft, TPath>,
    ...restProps
  }:
    | FormFieldPropsWithRender<TDraft, TPath>
    | FormFieldPropsWithComponent<TDraft, TPath, TComponent>,
) {
  type T = FieldChangeValue<TComponent>;

  const { value, setValue } = this.useField(name);
  const [localValue, setLocalValue] = useState<T>();

  useEffect(() => {
    if (localValue === undefined || !commitDebounce) {
      return;
    }

    const timeout = setTimeout(() => {
      setValue(deserialize(localValue));
      setLocalValue(undefined);
    }, commitDebounce);

    return () => clearTimeout(timeout);
  }, [localValue, commitDebounce]);

  const props = {
    ...restProps,
    name,
    value: localValue ?? serialize(value as Value<TDraft, TPath>),
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
        setValue(deserialize(value));
      }

      restProps.onChange?.(event, ...moreArgs);
    },
    onBlur(...args: any[]) {
      if (localValue !== undefined) {
        setValue(deserialize(localValue));
        setLocalValue(undefined);
      }

      restProps.onBlur?.apply(null, args);
    },
  };

  if (render) {
    return render(props as FormFieldComponentProps<Value<TDraft, TPath>, TPath>) ?? null;
  }

  if (component) {
    return createElement(component, props);
  }

  return null;
}
