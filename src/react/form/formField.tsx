import { type PathAsString } from '@index';
import { type Value } from '@lib/path';
import { useScope } from '@react/scope';
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
  id: string;
  name: TPath;
  value: TValue;
  onChange: (event: { target: { value: TValue } } | TValue | undefined, ...args: any[]) => void;
  onFocus: (...args: any[]) => void;
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

export type FormFieldProps<
  TDraft,
  TPath extends PathAsString<TDraft>,
  TComponent extends FormFieldComponent,
> = {
  name: TPath;
  component: TComponent;
  commitOnBlur?: boolean;
  commitDebounce?: number;
  inputFilter?: (value: FieldChangeValue<TComponent>) => boolean;
} & Omit<ComponentPropsWithoutRef<TComponent>, keyof FormFieldComponentProps<any, any>> &
  (Value<TDraft, TPath> extends FieldValue<TComponent>
    ? {
        serialize?: (value: Value<TDraft, TPath>) => FieldValue<TComponent>;
      }
    : {
        serialize: (value: Value<TDraft, TPath>) => FieldValue<TComponent>;
      }) &
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
    inputFilter,
    serialize = (x) => x as FieldValue<TComponent>,
    deserialize = (x) => x as Value<TDraft, TPath>,
    ...restProps
  }: FormFieldProps<TDraft, TPath, TComponent>,
): JSX.Element {
  type T = FieldChangeValue<TComponent>;
  const id = '';

  const form = this.useForm();
  const state = useScope(this.state);
  const { value, setValue, errors } = this.useField(name);

  const errorString = useMemo(
    () => errors.map((error) => form.options.localizeError?.(error, name) ?? error).join('\n'),
    [errors, form.options.localizeError],
  );
  const [localValue, setLocalValue] = useState<T>();
  const _id = useMemo(
    () =>
      id || `f${Math.random().toString(36).slice(2, 15)}${Math.random().toString(36).slice(2, 15)}`,

    [id],
  );

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

  useEffect(() => {
    const element = document.querySelector(
      [`#${_id} input`, `#${_id} select`, `#${_id} textarea`, `#${_id}`].join(','),
    );

    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      )
    ) {
      return;
    }

    element.setCustomValidity(errorString);
  }, [_id, errorString]);

  const props = {
    ...restProps,
    id: _id,
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
    onFocus(...args: any[]) {
      state.set('touched', (touched) => {
        touched = new Set(touched);
        touched.add(_id);
        return touched;
      });

      restProps.onFocus?.apply(null, args);
    },
    onBlur(...args: any[]) {
      if (localValue !== undefined) {
        setValue(deserialize(localValue));
        setLocalValue(undefined);
      }

      restProps.onBlur?.apply(null, args);
    },
  };

  return createElement(component, props);
}
