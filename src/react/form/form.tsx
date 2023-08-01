import { Scope, type Store, connectUrl, createStore, type UrlStoreOptions } from '@core';
import { autobind } from '@lib/autobind';
import { deepEqual } from '@lib/equals';
import { hash } from '@lib/hash';
import {
  type PathAsString,
  type Value,
  type WildcardPathAsString,
  type WildcardValue,
} from '@lib/path';
import { get } from '@lib/propAccess';
import { getWildCardMatches, wildcardMatch } from '@lib/wildcardMatch';
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ComponentPropsWithoutRef,
  type HTMLProps,
} from 'react';
import { ScopeProvider, useScope } from '../scope';
import { useStore, type UseStoreOptions } from '../useStore';
import { FormError, type FormErrorProps } from './formError';
import { FormField, type FormFieldComponent, type FormFieldProps } from './formField';

/// /////////////////////////////////////////////////////////////////////////////
// Form types
/// /////////////////////////////////////////////////////////////////////////////

export interface FormOptions<TDraft, TOriginal> {
  defaultValue: TDraft;
  validations?: Validations<TDraft, TOriginal>;
  localizeError?: (error: string) => string | undefined;
  urlState?: boolean | UrlStoreOptions<TDraft>;
}

export type Validations<TDraft, TOriginal> = {
  [P in WildcardPathAsString<TDraft>]?: Record<
    string,
    Validation<WildcardValue<TDraft, P>, TDraft, TOriginal>
  >;
};

export type Validation<TValue, TDraft, TOriginal> = (
  value: TValue,
  context: { draft: TDraft; original: TOriginal; field: PathAsString<TDraft> },
) => boolean;

export interface Field<TDraft, TOriginal, TPath extends PathAsString<TDraft>> {
  originalValue: Value<TOriginal, TPath> | undefined;
  value: Value<TDraft, TPath>;
  setValue: (
    value: Value<TDraft, TPath> | ((value: Value<TDraft, TPath>) => Value<TDraft, TPath>),
  ) => void;
  isDirty: boolean;
  errors: string[];
}

interface FormState<TDraft> {
  draft?: TDraft;
  touched: Set<string>;
  errors: Map<string, string[]>;
  hasTriggeredValidations?: boolean;
}

/// /////////////////////////////////////////////////////////////////////////////
// Implementation
/// /////////////////////////////////////////////////////////////////////////////

function FormContainer({
  form,
  ...formProps
}: { form: Form<any, any> } & Omit<HTMLProps<HTMLFormElement>, 'form'>) {
  const { validate } = form.useForm();

  return (
    <form
      {...formProps}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();

        validate();
        event.currentTarget.reportValidity();
      }}
    />
  );
}

function getFormInstance<TDraft, TOriginal extends TDraft>(
  original: TOriginal | undefined,
  options: FormOptions<TDraft, TOriginal>,
  state: Store<FormState<TDraft>>,
) {
  const instance = {
    original,

    draft: state.map(
      (state) => state.draft ?? original ?? options.defaultValue,
      (draft) => (state) => ({ ...state, draft }),
    ),

    options,

    getField: <TPath extends PathAsString<TDraft>>(
      path: TPath,
    ): Field<TDraft, TOriginal, TPath> => {
      const { draft } = instance;

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
          const comparisonValue = this.originalValue ?? get(options.defaultValue, path);

          return state.get().hasTriggeredValidations || !deepEqual(comparisonValue, this.value);
        },

        get errors() {
          const blocks: Record<string, Validation<any, any, any>>[] = Object.entries(
            options.validations ?? {},
          )
            .filter(([key]) => wildcardMatch(path, key))
            .map(([, value]) => value);

          const value = this.value;
          const draftValue = draft.get();
          const errors: string[] = [];

          for (const block of blocks ?? []) {
            for (const [validationName, validate] of Object.entries(block)) {
              if (!validate(value, { draft: draftValue, original, field: path })) {
                errors.push(validationName);
              }
            }
          }

          return errors;
        },
      };
    },

    get hasChanges() {
      const { draft } = state.get();
      return !!draft && !deepEqual(draft, original ?? options.defaultValue);
    },

    get errors(): string[] {
      const draft = instance.draft.get();
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

      return [...errors];
    },

    get isValid() {
      return instance.errors.length === 0;
    },

    validate: () => {
      state.set('hasTriggeredValidations', true);
      return instance.isValid;
    },

    reset() {
      state.set('draft', undefined);
    },
  };

  return instance;
}

export class Form<TDraft, TOriginal extends TDraft = TDraft> {
  context = createContext({
    original: undefined as TOriginal | undefined,
    options: this.options,
  });

  state = new Scope<FormState<TDraft>>({
    touched: new Set(),
    errors: new Map(),
  });

  constructor(public readonly options: FormOptions<TDraft, TOriginal>) {
    autobind(Form);
  }

  useForm() {
    const { original, options } = useContext(this.context);
    const state = useScope(this.state);

    return useMemo(() => getFormInstance(original, options, state), [original, options, state]);
  }

  useFormState<S>(selector: (state: ReturnType<typeof getFormInstance<TDraft, TOriginal>>) => S) {
    const { original, options } = useContext(this.context);
    const state = useScope(this.state);

    return useStore(state.map(() => selector(getFormInstance(original, options, state))));
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

    return useStore(form.draft.map(() => form.hasChanges));
  }

  useIsValid() {
    const form = this.useForm();

    return useStore(form.draft.map(() => form.isValid));
  }

  // ///////////////////////////////////////////////////////////////////////////
  // React Components
  // ///////////////////////////////////////////////////////////////////////////

  Form({
    original,
    defaultValue,
    validations,
    localizeError,
    urlState,
    ...formProps
  }: {
    original?: TOriginal;
  } & Partial<FormOptions<TDraft, TOriginal>> &
    Omit<HTMLProps<HTMLFormElement>, 'defaultValue'>) {
    const value = useMemo(
      () => ({
        original,
        options: {
          defaultValue: { ...this.options.defaultValue, ...defaultValue },
          validations: { ...this.options.validations, ...validations } as Validations<
            TDraft,
            TOriginal
          >,
          localizeError: localizeError ?? this.options.localizeError,
        },
      }),
      [original, defaultValue, validations],
    );

    const store = useMemo(() => {
      return createStore(this.state.defaultValue);
    }, []);

    useEffect(() => {
      if (urlState) {
        return connectUrl(
          store.map('draft'),
          typeof urlState === 'object' ? urlState : { key: 'form' },
        );
      }

      return undefined;
    }, [store, hash(urlState)]);

    return (
      <this.context.Provider value={value}>
        <ScopeProvider scope={this.state} store={store}>
          <FormContainer {...formProps} form={this} />
        </ScopeProvider>
      </this.context.Provider>
    );
  }

  Subscribe<S>({
    selector,
    children,
  }: {
    selector: (form: ReturnType<typeof getFormInstance<TDraft, TOriginal>>) => S;
    children: (selectedState: S) => ReactNode;
  }) {
    const selectedState = this.useFormState(selector);
    return <>{children(selectedState)}</>;
  }

  Field<
    TPath extends PathAsString<TDraft>,
    TComponent extends FormFieldComponent<any> = (
      props: ComponentPropsWithoutRef<'input'>,
    ) => JSX.Element,
  >(props: FormFieldProps<TDraft, TPath, TComponent>): JSX.Element {
    return Reflect.apply(FormField, this, [props]);
  }

  Error<TPath extends PathAsString<TDraft>>({ name }: FormErrorProps<TDraft, TPath>) {
    return Reflect.apply(FormError, this, [{ name }]);
  }
}

export function createForm<TDraft, TOriginal extends TDraft = TDraft>(
  options: FormOptions<TDraft, TOriginal>,
) {
  return new Form(options);
}