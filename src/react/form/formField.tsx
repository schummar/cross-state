import { type PathAsString } from '@index';
import { type Value } from '@lib/path';
import { useScope } from '@react/scope';
import {
  createElement,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ComponentType,
  type HTMLProps,
} from 'react';
import { type Form } from './form';

interface FormFieldComponentProps<TValue, TPath> {
  id?: string;
  name: TPath;
  value: TValue;
  onChange: (event: { target: { value: TValue } } | TValue | undefined, ...args: any[]) => void;
  onFocus: (...args: any[]) => void;
  onBlur: (...args: any[]) => void;
}

type NativeInputType = 'input' | 'select' | 'textarea';

type FieldValue<T extends FormFieldComponent<any, any>> = ComponentPropsWithoutRef<
  T & 'input'
> extends {
  value: infer U;
}
  ? U
  : ComponentPropsWithoutRef<T & 'input'> extends {
      value?: infer U;
    }
  ? U | undefined
  : never;

type FieldChangeValue<T extends FormFieldComponent<any, any>> = ComponentPropsWithoutRef<
  T & 'input'
> extends {
  onChange?: (update: infer U) => void;
}
  ? U extends { target: { value: infer V } }
    ? V
    : U
  : never;

type A = FieldChangeValue<'input'>;

export type FormFieldComponent<TValue, TPath> =
  | (string | number extends TValue ? NativeInputType : never)
  | ComponentType<FormFieldComponentProps<TValue, TPath>>;

export type FormFieldProps<
  TDraft,
  TPath extends PathAsString<TDraft>,
  TComponent extends FormFieldComponent<any, TPath>,
> = {
  name: TPath;
  commitOnBlur?: boolean;
  commitDebounce?: number;
  inputFilter?: (value: FieldChangeValue<TComponent>) => boolean;
  onChange?: ComponentPropsWithoutRef<TComponent>['onChange'];
  onBlur?: ComponentPropsWithoutRef<TComponent>['onBlur'];
} & (TComponent extends
  | 'input'
  | ((props: ComponentPropsWithoutRef<'input'> & { name: TPath }) => JSX.Element)
  ? { component?: TComponent } | { children?: TComponent }
  : { component: TComponent } | { children: TComponent }) &
  Omit<
    ComponentPropsWithoutRef<TComponent>,
    | 'form'
    | 'name'
    | 'component'
    | 'commitOnBlur'
    | 'commitDebounce'
    | 'value'
    | 'onChange'
    | 'onBlur'
    | 'children'
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
  TComponent extends FormFieldComponent<any, any>,
>(
  this: Form<TDraft, any>,
  {
    // id,
    name,
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
  const component = (('component' in restProps
    ? restProps.component
    : 'children' in restProps
    ? restProps.children
    : undefined) ?? 'input') as TComponent;

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
    component: undefined,
    children: undefined,
    id: _id,
    name,
    value: localValue ?? serialize(value),
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
