import { isObject } from '@lib/helpers';
import { type GetKeys, type Join, type PathAsString, type Value } from '@lib/path';
import { join } from '@lib/propAccess';
import { Fragment, useCallback, type ReactNode } from 'react';
import { type FieldHelperMethods, type Form } from './form';

export type ElementName<TDraft, TPath extends string> = keyof {
  [Path in TPath as Join<Path, GetKeys<NonNullable<Value<TDraft, Path>>> & (string | number)>]: 1;
};

type ItemValue<T> = T extends readonly (infer U)[] ? U : T[keyof T];

export interface FormForEachProps<TDraft, TPath extends string> {
  name: TPath extends PathAsString<TDraft> ? TPath : PathAsString<TDraft>;
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
  filter?: (
    item: ItemValue<NonNullable<Value<TDraft, TPath>>>,
    key: GetKeys<NonNullable<Value<TDraft, TPath>>>,
    parent: NonNullable<Value<TDraft, TPath>>,
  ) => boolean;
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
  {
    name,
    renderElement,
    renderAdditionalElement,
    filter,
    children,
  }: FormForEachProps<TDraft, TPath>,
): React.JSX.Element {
  const form = this.useForm();

  const items = this.useFormState(() => {
    const field = form.getField(name);

    let keys: (string | number)[] = isObject(field.value) ? Object.keys(field.value) : [];
    const count = keys.length;

    if (Array.isArray(field.value)) {
      keys = keys.map(Number);
    }

    if (filter) {
      keys = keys.filter((key, index) =>
        filter((field.value as any)[index], key as any, field.value as any),
      );
    }

    if (renderAdditionalElement) {
      keys.push(count);
    }

    return keys.map((key) => ({
      key,
      name: join(name, String(key)),
    }));
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
        items.map(({ key, name }, index) => {
          return (
            <Fragment key={key}>
              {renderElement({
                name: name as any,
                key: key as any,
                index,
                remove: () => remove(key),
                count: items.length,
              })}
            </Fragment>
          );
        })}

      {children?.({
        names: items.map((item) => item.name),
        add,
        remove,
        setValue,
      } as any)}
    </>
  );
}
