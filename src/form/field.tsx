import React, { ChangeEvent, ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { SelectorPaths, SelectorValue } from '../helpers/stringSelector';
import { Form } from './form';
import { useField } from './useField';

export type FieldPropsWithoutForm<
  T,
  Name extends SelectorPaths<T>,
  Component extends ElementType<{
    value?: SelectorValue<T, Name>;
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  }>
> = { name: Name } & (({ component: Component } & Omit<ComponentPropsWithoutRef<Component>, 'value'>) | { render: () => ReactNode });

export type FieldProps<
  T,
  Name extends SelectorPaths<T>,
  Component extends ElementType<{
    value?: SelectorValue<T, Name>;
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  }>
> = { form: Form<T> } & FieldPropsWithoutForm<T, Name, Component>;

export function Field<
  T,
  Name extends SelectorPaths<T>,
  Component extends ElementType<{
    value?: SelectorValue<T, Name>;
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  }>
>({ form, name, ...props }: FieldProps<T, Name, Component>): JSX.Element {
  const [value = '', setValue] = useField(form, name);

  if ('component' in props) {
    const { component: C, ...restProps } = props;

    return <C {...(restProps as any)} value={value} onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value)} />;
  }

  return <>{props.render()}</>;
}
