import { type GetKeys, type Join, type PathAsString, type Value } from '@lib/path';
import { Fragment, useCallback, type ReactNode } from 'react';
import { type FieldHelperMethods, type Form } from './form';

export type ForEachPath<T> = PathAsString<T>;

export type ElementName<TDraft, TPath extends PathAsString<TDraft>> = Join<
  TPath,
  GetKeys<NonNullable<Value<TDraft, TPath>>> & (string | number)
>;

export interface FormForEachProps<TDraft, TPath extends ForEachPath<TDraft>> {
  name: TPath;
  renderElement?: (props: {
    name: ElementName<TDraft, TPath>;
    key: `${GetKeys<NonNullable<Value<TDraft, TPath>>> & (string | number)}`;
    index: number;
    remove: () => void;
  }) => ReactNode;
  children?: (
    props: {
      setValue: (
        value: Value<TDraft, TPath> | ((value: Value<TDraft, TPath>) => Value<TDraft, TPath>),
      ) => void;
    } & FieldHelperMethods<TDraft, TPath>,
  ) => ReactNode;
}

export function FormForEach<TDraft, TPath extends ForEachPath<TDraft>>(
  this: Form<TDraft, any>,
  { name, renderElement, children }: FormForEachProps<TDraft, TPath>,
): JSX.Element {
  const form = this.useForm();

  const names = this.useFormState(() => {
    const field = form.getField(name) as any;
    return field.names as any[];
  });

  const add = useCallback(
    (...args: any[]) => {
      const field = form.getField(name) as any;
      field.add(...args);
    },
    [form],
  );

  const remove = useCallback(
    (key: any) => {
      const field = form.getField(name) as any;
      field.remove(key);
    },
    [form],
  );

  const setValue = useCallback(
    (value: Value<TDraft, TPath> | ((value: Value<TDraft, TPath>) => Value<TDraft, TPath>)) => {
      const field = form.getField(name) as any;
      field.setValue(value);
    },
    [form],
  );

  return (
    <>
      {renderElement &&
        names.map((name, index) => {
          const key = name.split('.').pop();

          return (
            <Fragment key={key}>
              {renderElement({
                name,
                key,
                index,
                remove: () => remove(index),
              })}
            </Fragment>
          );
        })}

      {children?.({
        names,
        add,
        remove,
        setValue,
      } as any)}
    </>
  );
}
