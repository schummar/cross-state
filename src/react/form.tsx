/* eslint-disable react-hooks/rules-of-hooks */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useScope } from './scope';
import { useStore, type UseStoreOptions } from './useStore';
import { Scope } from '@core';
import { deepEqual } from '@lib/equals';
import {
  type PathAsString,
  type Value,
  type WildcardMatch,
  type WildcardPathAsString,
  type WildcardValue,
} from '@lib/path';
import { get } from '@lib/propAccess';
import { getWildCardMatches, wildcardMatch } from '@lib/wildcardMatch';

export interface FormOptions<
  TDraft,
  TOriginal,
  TValidations extends Validations<TDraft, TOriginal>,
> {
  defaultValue: TDraft;
  validations?: TValidations;
}

export type Validation<TValue, TDraft, TOriginal> = (
  value: TValue,
  context: { draft: TDraft; original: TOriginal; field: PathAsString<TDraft> },
) => boolean;

export type Validations<TDraft, TOriginal> = {
  [P in WildcardPathAsString<TDraft>]?: Record<
    string,
    Validation<WildcardValue<TDraft, P>, TDraft, TOriginal>
  >;
};

export interface Field<
  TDraft,
  TOriginal,
  TPath extends PathAsString<TDraft>,
  TValidations extends Validations<TDraft, TOriginal>,
> {
  originalValue: Value<TOriginal, TPath> | undefined;
  value: Value<TDraft, TPath>;
  setValue: (
    value: Value<TDraft, TPath> | ((value: Value<TDraft, TPath>) => Value<TDraft, TPath>),
  ) => void;
  isDirty: boolean;
  error?: keyof {
    [P in keyof TValidations as WildcardMatch<TPath, P> extends true
      ? keyof TValidations[P]
      : never]: 1;
  };
}

export class Form<
  TDraft,
  TOriginal extends TDraft = TDraft,
  TValidations extends Validations<TDraft, TOriginal> = {},
> {
  private context = createContext({
    original: undefined as TOriginal | undefined,
    options: this.options,
  });

  private state = new Scope<{
    draft?: TDraft;
    hasTriggeredValidations?: boolean;
  }>({});

  constructor(public readonly options: FormOptions<TDraft, TOriginal, TValidations>) {
    this.Provider = this.Provider.bind(this);
  }

  Provider({
    children,
    original,
    defaultValue = this.options.defaultValue,
    validations = this.options.validations,
  }: { children?: ReactNode; original?: TOriginal } & Partial<
    FormOptions<TDraft, TOriginal, TValidations>
  >) {
    const value = useMemo(
      () => ({ original, options: { defaultValue, validations } }),
      [original, defaultValue, validations],
    );

    return (
      <this.context.Provider value={value}>
        <this.state.Provider>{children}</this.state.Provider>
      </this.context.Provider>
    );
  }

  useForm() {
    const { original, options } = useContext(this.context);
    const state = useScope(this.state);

    return useMemo(
      () => ({
        original,

        draft: state.map(
          (state) => state.draft ?? original ?? options.defaultValue,
          (draft) => (state) => ({ ...state, draft }),
        ),

        getField<TPath extends PathAsString<TDraft>>(
          path: TPath,
        ): Field<TDraft, TOriginal, TPath, TValidations> {
          const { draft } = this;

          return {
            get originalValue() {
              return original !== undefined ? get(original as any, path as any) : undefined;
            },

            get value() {
              return get(draft.get(), path);
            },

            setValue(update) {
              draft.set(path, update);
            },

            get isDirty() {
              return (
                state.get().hasTriggeredValidations || !deepEqual(this.originalValue, this.value)
              );
            },

            get error() {
              const blocks: Record<string, Validation<any, any, any>>[] = Object.entries(
                options.validations ?? {},
              )
                .filter(([key]) => wildcardMatch(path, key))
                .map(([, value]) => value);

              const value = this.value;
              const draftValue = draft.get();

              for (const block of blocks ?? []) {
                for (const [validationName, validate] of Object.entries(block)) {
                  if (!validate(value, { draft: draftValue, original, field: path })) {
                    return validationName as any;
                  }
                }
              }

              return undefined;
            },
          };
        },

        hasChanges() {
          const { draft } = state.get();
          return !!draft && !deepEqual(draft, original);
        },

        getErrors(): (keyof {
          [Field in PathAsString<TDraft> as keyof {
            [Pattern in keyof TValidations as WildcardMatch<Field, Pattern> extends true
              ? `${Field}.${keyof TValidations[Pattern] & string}`
              : never]: 1;
          }]: 1;
        })[] {
          const draft = this.draft.get();
          const errors = new Set<string>();

          for (const [path, block] of Object.entries(options.validations ?? {})) {
            for (const [validationName, validate] of Object.entries(
              block as Record<string, Validation<any, any, any>>,
            )) {
              for (const [field, value] of Object.entries(getWildCardMatches(draft, path))) {
                if (!validate(value, { draft, original, field })) {
                  errors.add(`${field}.${validationName}`);
                }
              }
            }
          }

          return [...errors] as any;
        },

        isValid() {
          return this.getErrors().length === 0;
        },

        validate() {
          state.set('hasTriggeredValidations', true);
          return this.isValid();
        },

        reset() {
          state.set('draft', undefined);
        },
      }),
      [original, options, state],
    );
  }

  useField<TPath extends PathAsString<TDraft>>(path: TPath, useStoreOptions?: UseStoreOptions) {
    const form = this.useForm();
    const state = useScope(this.state);

    useStore(
      form.draft.map((draft) => get(draft, path)),
      useStoreOptions,
    );

    useStore(
      state.map((state) => state.hasTriggeredValidations),
      useStoreOptions,
    );

    return form.getField(path);
  }

  useHasChanges() {
    const form = this.useForm();

    return useStore(form.draft.map(() => form.hasChanges()));
  }

  useIsValid() {
    const form = this.useForm();

    return useStore(form.draft.map(() => form.isValid()));
  }
}

export function createForm<
  TDraft,
  TOriginal extends TDraft = TDraft,
  TValidations extends Validations<TDraft, TOriginal> = {},
>(options: FormOptions<TDraft, TOriginal, TValidations>) {
  return new Form(options);
}

/* eslint-enable react-hooks/rules-of-hooks */
