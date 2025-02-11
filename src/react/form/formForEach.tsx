import { type GetKeys, type Join, type PathAsString, type Value } from '@lib/path';
import { Fragment, useCallback, type ReactNode } from 'react';
import { type FieldHelperMethods, type Form } from './form';

export type ElementName<TDraft, TPath extends string> = keyof {
  [Path in TPath as Join<Path, GetKeys<NonNullable<Value<TDraft, Path>>> & (string | number)>]: 1;
};

export interface FormForEachProps<TDraft, TPath extends string> {
  name: TPath & PathAsString<TDraft>;
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

export function FormForEach<TDraft, TPath extends string>(
  this: Form<TDraft, any>,
  { name, renderElement, children }: FormForEachProps<TDraft, TPath>,
): JSX.Element {
  const form = this.useForm();

  const names = this.useFormState(() => {
    const field = form.getField(name as any) as any;
    return field.names as any[];
  });

  const add = useCallback(
    (...args: any[]) => {
      const field = form.getField(name as any) as any;
      field.add(...args);
    },
    [form],
  );

  const remove = useCallback(
    (key: any) => {
      const field = form.getField(name as any) as any;
      field.remove(key);
    },
    [form],
  );

  const setValue = useCallback(
    (value: Value<TDraft, TPath> | ((value: Value<TDraft, TPath>) => Value<TDraft, TPath>)) => {
      const field = form.getField(name as any) as any;
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
                remove: () => remove(key),
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
