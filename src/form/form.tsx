import { castDraft } from 'immer';
import React, { ChangeEvent, ComponentPropsWithoutRef, createContext, ElementType, ReactNode, useContext, useMemo } from 'react';
import { SelectorPaths, SelectorValue } from '../helpers/stringSelector';
import { Store } from '../react';
import { Field, FieldPropsWithoutForm } from './field';
import { useField } from './useField';

export type FormState<T> = {
  value: T;
  dirtyValue: DeepPartial<T>;
  validations: (() => unknown)[];
  errors: Map<string, unknown>;
};

export class Form<T> {
  readonly state;

  constructor(value: T) {
    this.Field = this.Field.bind(this);

    this.state = new Store<FormState<T>>({
      value,
      dirtyValue: {},
      validations: [],
      errors: new Map(),
    });

    this.state.subscribe(
      (s) => s,
      (s) => console.log(s.value, s.dirtyValue)
    );
  }

  setValue(value: T): void {
    this.state.update((state) => {
      state.value = castDraft(value);
    });
  }

  useField<Name extends SelectorPaths<T>>(name: Name) {
    return useField(this, name);
  }

  Field<
    Name extends SelectorPaths<T>,
    Component extends ElementType<{
      value?: SelectorValue<T, Name>;
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    }>
  >(props: FieldPropsWithoutForm<T, Name, Component>): JSX.Element {
    return <Field {...props} form={this} />;
  }
}

export class FormDefinition<T> {
  readonly context = createContext<Form<T> | null>(null);

  constructor() {
    this.Field = this.Field.bind(this);
  }

  Provider = ({ children, value }: { children: ReactNode; value: T }): JSX.Element => {
    const form = useMemo(() => new Form(value), []);
    form.setValue(value);

    return <this.context.Provider value={form}>{children}</this.context.Provider>;
  };

  private useForm(): Form<T> {
    const form = useContext(this.context);
    if (!form) throw Error('No form context!');
    return form;
  }

  useField<Name extends SelectorPaths<T>>(
    name: Name
  ): [
    value: SelectorValue<T, Name>,
    setValue: (value: SelectorValue<T, Name>) => void,
    state: {
      isDirty: boolean;
      error?: unknown;
    }
  ] {
    const form = this.useForm();
    return form.useField(name);
  }

  Field<
    Name extends SelectorPaths<T>,
    Component extends ElementType<{
      value?: SelectorValue<T, Name>;
      onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    }>
  >(
    props: {
      name: Name;
      component: Component;
    } & Omit<ComponentPropsWithoutRef<Component>, 'value'>
  ): JSX.Element {
    const form = this.useForm();
    return <form.Field {...props} />;
  }
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Record<string, unknown> ? DeepPartial<T[P]> : T[P];
};
