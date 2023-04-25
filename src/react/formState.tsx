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

export interface FormStateOptions<
  TDraft,
  TOriginal,
  TValidations extends Validations<TDraft, TOriginal>,
> {
  defaultValue: TDraft;
  validations?: TValidations;
}

type Validation<TValue, TDraft, TOriginal> = (
  value: TValue,
  context: { draft: TDraft; original: TOriginal },
) => boolean;

type Validations<TDraft, TOriginal> = {
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

export class FormState<
  TDraft,
  TOriginal extends TDraft = TDraft,
  TValidations extends Validations<TDraft, TOriginal> = never,
> {
  private original = createContext<TOriginal | undefined>(undefined);

  private state = new Scope<{
    draft?: TDraft;
    hasTriggeredValidations?: boolean;
  }>({});

  constructor(public readonly options: FormStateOptions<TDraft, TOriginal, TValidations>) {
    this.Provider = this.Provider.bind(this);
  }

  Provider({ children, original }: { children?: ReactNode; original?: TOriginal }) {
    return (
      <this.original.Provider value={original}>
        <this.state.Provider>{children}</this.state.Provider>
      </this.original.Provider>
    );
  }

  useForm() {
    const original = useContext(this.original);
    const state = useScope(this.state);
    const { options } = this;

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
              const context = {
                original,
                draft: draft.get(),
              };

              for (const block of blocks ?? []) {
                for (const [validationName, validate] of Object.entries(block)) {
                  if (!validate(value, context)) {
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
          const context = {
            original,
            draft,
          };
          const errors: string[] = [];

          for (const [path, block] of Object.entries(options.validations ?? {})) {
            for (const [validationName, validate] of Object.entries(
              block as Record<string, Validation<any, any, any>>,
            )) {
              for (const [field, value] of Object.entries(getWildCardMatches(draft, path))) {
                if (!validate(value, context)) {
                  errors.push(`${field}.${validationName}`);
                }
              }
            }
          }

          return errors as any;
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
      [original, state, options],
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

function createForm<
  TDraft,
  TOriginal extends TDraft,
  TValidations extends Validations<TDraft, TOriginal>,
>(options: FormStateOptions<TDraft, TOriginal, TValidations>) {
  return new FormState(options);
}

const form = createForm({
  defaultValue: {
    a: 'b',
    b: [1, 2, 3] as const,
    c: { a: 1, b: '2' },
  },

  validations: {
    a: {
      length: (a) => a.length > 0,
      someThingElse: (a) => a.length > 10,
    },

    'b.*': {
      positive: (b) => b > 0,
      threeDigits: (b) => b > 100 && b < 1000,
    },

    'b.1': {
      negative: (b) => b < 0,
    },

    'c.*': {
      foo: (c) => typeof c === 'string',
    },
  },
});
const _x = form.useField('a').error;
const _y = form.useField('b.1').error;
const _errors = form.useForm().getErrors();

/* eslint-enable react-hooks/rules-of-hooks */
