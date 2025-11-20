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
    count: number;
  }) => ReactNode;
  renderAdditionalElement?: NonNullable<Value<TDraft, TPath>> extends readonly any[]
    ? boolean
    : never;
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
  { name, renderElement, renderAdditionalElement, children }: FormForEachProps<TDraft, TPath>,
): React.JSX.Element {
  const form = this.useForm();

  const names = this.useFormState(() => {
    const field = form.getField(name);
    const names = (field as any).names as string[];

    if (renderAdditionalElement && Array.isArray(names)) {
      names.push(`${name}.${names.length}`);
    }

    return names;
  });

  const add = useCallback(
    (...args: any[]) => {
      const field = form.getField(name as any) as any;
      field.add(...args);
    },
    [form, name],
  );

  const remove = useCallback(
    (key: any) => {
      const field = form.getField(name as any) as any;
      field.remove(key);
    },
    [form, name],
  );

  const setValue = useCallback(
    (value: Value<TDraft, TPath> | ((value: Value<TDraft, TPath>) => Value<TDraft, TPath>)) => {
      const field = form.getField(name as any) as any;
      field.setValue(value);
    },
    [form, name],
  );

  return (
    <>
      {renderElement &&
        names.map((name, index) => {
          const key = name.split('.').pop();

          return (
            <Fragment key={key}>
              {renderElement({
                name: name as any,
                key: key as any,
                index,
                remove: () => remove(key),
                count: names.length,
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
