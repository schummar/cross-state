import { type PathAsString, type Value } from '@lib/path';
import { Fragment, useCallback, type ReactNode } from 'react';
import { type ArrayFieldMethods, type Field, type Form } from './form';

export type ArrayPath<T> = keyof {
  [P in PathAsString<T> as Value<T, P> extends readonly any[] | undefined ? P : never]: never;
} &
  PathAsString<T> &
  string;

export interface FormArrayProps<TDraft, TPath extends ArrayPath<TDraft>> {
  name: TPath;
  renderElement?: (props: {
    name: `${TPath}.${number}`;
    index: number;
    remove: () => void;
  }) => ReactNode;
  children?: (props: {
    names: `${TPath}.${number}`[];
    append: (...elements: Value<TDraft, `${TPath}.${number}`>[]) => void;
    remove: (index: number) => void;
    setValue: (
      value: Value<TDraft, TPath> | ((value: Value<TDraft, TPath>) => Value<TDraft, TPath>),
    ) => void;
  }) => ReactNode;
}

export function FormArray<TDraft, TPath extends ArrayPath<TDraft>>(
  this: Form<TDraft, any>,
  { name, renderElement, children }: FormArrayProps<TDraft, TPath>,
) {
  const form = this.useForm();

  const names = this.useFormState(() => {
    const field = form.getField(name) as Field<any, any, any> & ArrayFieldMethods<any, any>;
    return field.names;
  });

  const append = useCallback(
    (...newEntries: Value<TDraft, `${TPath}.${number}`>[]) => {
      const field = form.getField(name) as Field<any, any, any> & ArrayFieldMethods<any, any>;
      field.append(...newEntries);
    },
    [form],
  );

  const remove = useCallback(
    (index: number) => {
      const field = form.getField(name) as Field<any, any, any> & ArrayFieldMethods<any, any>;
      field.remove(index);
    },
    [form],
  );

  const setValue = useCallback(
    (value: Value<TDraft, TPath> | ((value: Value<TDraft, TPath>) => Value<TDraft, TPath>)) => {
      const field = form.getField(name) as Field<any, any, any> & ArrayFieldMethods<any, any>;
      field.setValue(value);
    },
    [form],
  );

  return (
    <>
      {renderElement &&
        names.map((name, index) => (
          <Fragment key={index}>
            {renderElement({
              name,
              index,
              remove: () => remove(index),
            })}
          </Fragment>
        ))}

      {children?.({
        names,
        append,
        remove,
        setValue,
      })}
    </>
  );
}
