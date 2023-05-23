import {
  type ComponentPropsWithoutRef,
  type ElementType,
  createElement,
  useEffect,
  useState,
} from 'react';
import { type Form } from './form';
import { type PathAsString } from '@index';
import { type Value } from '@lib/path';

export type FormInputComponent<T> = ElementType<{
  value?: T;
  onChange?: (event: { target: { value: T } } | T, ...args: any[]) => void;
  onBlur?: (...args: any[]) => void;
}>;

type InputValue<T extends FormInputComponent<any>> = ComponentPropsWithoutRef<T> extends {
  value?: infer U;
}
  ? U
  : never;

type InputChangeValue<T extends FormInputComponent<any>> = Parameters<
  NonNullable<ComponentPropsWithoutRef<T>['onChange']>
>[0] extends infer S
  ? S extends { target: { value: infer U } }
    ? U
    : S
  : never;

export type FormInputPropsWithoutComponent<
  TDraft,
  TPath extends PathAsString<TDraft>,
  TComponent extends FormInputComponent<any>,
> = {
  name: TPath;
  commitOnBlur?: boolean;
  commitDebounce?: number;
} & Omit<
  ComponentPropsWithoutRef<TComponent>,
  'form' | 'name' | 'component' | 'commitOnBlur' | 'commitDebounce' | 'value'
> &
  (Value<TDraft, TPath> extends InputValue<TComponent>
    ? { serialize?: (value: Value<TDraft, TPath>) => InputValue<TComponent> }
    : { serialize: (value: Value<TDraft, TPath>) => InputValue<TComponent> }) &
  (InputChangeValue<TComponent> extends Value<TDraft, TPath>
    ? { deserialize?: (value: InputChangeValue<TComponent>) => Value<TDraft, TPath> }
    : { deserialize: (value: InputChangeValue<TComponent>) => Value<TDraft, TPath> });

export type FormInputProps<
  TDraft,
  TPath extends PathAsString<TDraft>,
  TComponent extends FormInputComponent<any>,
> = FormInputPropsWithoutComponent<TDraft, TPath, TComponent> & {
  component: TComponent;
};

export function FormInput<
  TDraft,
  TPath extends PathAsString<TDraft>,
  TComponent extends FormInputComponent<any>,
>(
  this: Form<TDraft, any>,
  {
    name,
    component = 'input' as TComponent,
    commitOnBlur,
    commitDebounce,
    serialize = (x) => x as InputValue<TComponent>,
    deserialize = (x) => x as Value<TDraft, TPath>,
    ...restProps
  }: FormInputPropsWithoutComponent<TDraft, TPath, TComponent> & {
    component?: TComponent;
  },
): JSX.Element {
  type T = InputChangeValue<TComponent>;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localValue, commitDebounce]);

  const props = {
    ...restProps,
    value: localValue ?? serialize(value),
    onChange: (event: { target: { value: T } } | T, ...moreArgs: any[]) => {
      const value =
        typeof event === 'object' && event !== null && 'target' in event
          ? event.target.value
          : event;

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

      restProps.onBlur?.(...(args as [any]));
    },
  };

  return createElement(component, props as any);
}
