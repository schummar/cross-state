import {
  createElement,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ElementType,
  type HTMLProps,
} from 'react';
import { type Form } from './form';
import { type PathAsString } from '@index';
import { type Value } from '@lib/path';

export type FormInputComponent<T> = ElementType<{
  id: string;
  value: T;
  onChange: (event: { target: { value: T } } | T | undefined, ...args: any[]) => void;
  onBlur: (...args: any[]) => void;
}>;

type InputValue<T extends FormInputComponent<any>> = ComponentPropsWithoutRef<T> extends {
  value: infer U;
}
  ? U
  : ComponentPropsWithoutRef<T> extends {
      value?: infer U;
    }
  ? U | undefined
  : never;

type InputChangeValue<T extends FormInputComponent<any>> = ComponentPropsWithoutRef<T> extends {
  onChange?: (update: infer U) => void;
}
  ? U extends { target: { value: infer V } }
    ? V
    : U
  : never;

export type FormInputProps<
  TDraft,
  TPath extends PathAsString<TDraft>,
  TComponent extends FormInputComponent<any>,
> = {
  name: TPath;
  commitOnBlur?: boolean;
  commitDebounce?: number;
  inputFilter?: (value: InputChangeValue<TComponent>) => boolean;
  onChange?: ComponentPropsWithoutRef<TComponent>['onChange'];
  onBlur?: ComponentPropsWithoutRef<TComponent>['onBlur'];
} & (TComponent extends 'input' | ((props: HTMLProps<HTMLInputElement>) => JSX.Element)
  ? { component?: TComponent }
  : { component: TComponent }) &
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
  > &
  (Value<TDraft, TPath> extends InputValue<TComponent>
    ? { serialize?: (value: Value<TDraft, TPath>) => InputValue<TComponent> }
    : { serialize: (value: Value<TDraft, TPath>) => InputValue<TComponent> }) &
  (InputChangeValue<TComponent> extends Value<TDraft, TPath>
    ? { deserialize?: (value: InputChangeValue<TComponent>) => Value<TDraft, TPath> }
    : { deserialize: (value: InputChangeValue<TComponent>) => Value<TDraft, TPath> });

export function FormInput<
  TDraft,
  TPath extends PathAsString<TDraft>,
  TComponent extends FormInputComponent<any>,
>(
  this: Form<TDraft, any>,
  {
    id,
    name,
    component = 'input' as TComponent,
    commitOnBlur,
    commitDebounce,
    inputFilter,
    serialize = (x) => x as InputValue<TComponent>,
    deserialize = (x) => x as Value<TDraft, TPath>,
    ...restProps
  }: FormInputProps<TDraft, TPath, TComponent>,
): JSX.Element {
  type T = InputChangeValue<TComponent>;

  const { value, setValue, errors } = this.useField(name);
  const errorString = useMemo(() => errors.join('\n'), [errors]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
