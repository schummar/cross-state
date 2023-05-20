import {
  type ReactNode,
  createElement,
  type ComponentPropsWithoutRef,
  type ElementType,
} from 'react';
import { type Form } from './form';
import { type PathAsString } from '@lib/path';

export type FormErrorComponent = ElementType<{
  children: ReactNode;
}>;

export type FormErrorProps<
  TDraft,
  TPath extends PathAsString<TDraft>,
  TComponent extends FormErrorComponent,
> = {
  form: Form<TDraft, any>;
  name: TPath;
  component: TComponent;
} & Omit<ComponentPropsWithoutRef<TComponent>, 'form' | 'name' | 'component'>;

export function FormError<
  TDraft,
  TPath extends PathAsString<TDraft>,
  TComponent extends FormErrorComponent,
>({ form, name, component, ...restProps }: FormErrorProps<TDraft, TPath, TComponent>) {
  const { errors, isDirty } = form.useField(name);

  const props = {
    ...restProps,
    children: isDirty ? errors.join(', ') : '',
  };

  return createElement(component, props);
}
