import { connectUrl, createStore, type Store, type UrlStoreOptions } from '@core';
import { autobind } from '@lib/autobind';
import { deepEqual } from '@lib/equals';
import { hash } from '@lib/hash';
import {
  type Path,
  type PathAsString,
  type Value,
  type WildcardPathAsString,
  type WildcardValue,
} from '@lib/path';
import { get } from '@lib/propAccess';
import { getWildCardMatches } from '@lib/wildcardMatch';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ComponentPropsWithoutRef,
  type HTMLProps,
  type ReactNode,
} from 'react';
import { useStore, type UseStoreOptions } from '../useStore';
import { FormArrayField, type ArrayPath, type FormArrayFieldProps } from './formArrayField';
import { FormError, type FormErrorProps } from './formError';
import { FormField, type FormFieldComponent, type FormFieldProps } from './formField';
import { useFormAutosave, type FormAutosaveOptions } from './useFormAutosave';

/// /////////////////////////////////////////////////////////////////////////////
// Form types
/// /////////////////////////////////////////////////////////////////////////////

export type Transform<TDraft> = Path<TDraft> | '' extends infer TPath
  ? TPath extends TPath
    ? {
        update: (value: Value<TDraft, TPath>, store: Store<TDraft>) => void | TDraft;
      } & (TPath extends '' ? { trigger?: '' } : { trigger: TPath })
    : never
  : never;

export interface FormOptions<TDraft, TOriginal> {
  defaultValue: TDraft;
  validations?: Validations<TDraft, TOriginal>;
  localizeError?: (error: string, field: string) => string | undefined;
  urlState?: boolean | UrlStoreOptions<TDraft>;
  autoSave?: FormAutosaveOptions<TDraft, TOriginal>;
  transform?: Transform<TDraft>[];
}

export type Validations<TDraft, TOriginal> = {
  [TPath in WildcardPathAsString<TDraft>]?: Record<string, Validation<TDraft, TOriginal, TPath>>;
} & Record<string, Record<string, Validation<TDraft, TOriginal, any>>>;

export type Validation<TDraft, TOriginal, TPath> = (
  value: WildcardValue<TDraft, TPath>,
  context: {
    draft: TDraft;
    original: TOriginal;
    field: PathAsString<TDraft> | '';
  },
) => boolean;

export type Field<TDraft, TOriginal, TPath extends PathAsString<TDraft>> = {
  originalValue: Value<TOriginal, TPath> | undefined;
  value: Value<TDraft, TPath>;
  setValue: (
    value: Value<TDraft, TPath> | ((value: Value<TDraft, TPath>) => Value<TDraft, TPath>),
  ) => void;
  hasChange: boolean;
  errors: string[];
} & (Value<TDraft, TPath> extends Array<any> ? ArrayFieldMethods<TDraft, TPath> : {});

export type ArrayFieldMethods<TPath, TValue> = {
  names: TPath[];
  append: (...elements: TValue[]) => void;
  remove: (index: number) => void;
};

export interface FormState<TDraft> {
  draft: TDraft | undefined;
  hasTriggeredValidations: boolean;
  saveScheduled: boolean;
  saveInProgress: boolean;
}

export interface FormDerivedState<TDraft> {
  draft: TDraft;
  hasTriggeredValidations: boolean;
  saveScheduled: boolean;
  saveInProgress: boolean;
  hasChanges: boolean;
  errors: Map<string, string[]>;
  isValid: boolean;
}

export interface FormContext<TDraft, TOriginal> {
  formState: Store<FormState<TDraft>>;
  derivedState: Store<FormDerivedState<TDraft>>;
  options: FormOptions<TDraft, TOriginal>;
  original: TOriginal | undefined;
  getField: <TPath extends PathAsString<TDraft>>(path: TPath) => Field<TDraft, TOriginal, TPath>;
  getDraft: () => TDraft;
  hasTriggeredValidations: () => boolean;
  hasChanges: () => boolean;
  getErrors: () => Map<string, string[]>;
  isValid: () => boolean;
  validate: () => boolean;
  reset: () => void;
}

export interface FormInstance<TDraft, TOriginal>
  extends FormDerivedState<TDraft>,
    Pick<FormContext<TDraft, TOriginal>, 'options' | 'original' | 'getField'> {}

/// /////////////////////////////////////////////////////////////////////////////
// Implementation
/// /////////////////////////////////////////////////////////////////////////////

function FormContainer({
  form,
  ...formProps
}: { form: Form<any, any> } & Omit<HTMLProps<HTMLFormElement>, 'form'>) {
  const { validate, options, getErrors } = form.useForm();
  const errors = getErrors();
  const hasTriggeredValidations = form.useFormState((state) => state.hasTriggeredValidations);

  return (
    <form
      noValidate
      {...formProps}
      className={[formProps.className, hasTriggeredValidations ? 'validated' : undefined]
        .filter(Boolean)
        .join(' ')}
      onSubmit={(event) => {
        event.preventDefault();

        const isValid = validate();

        let button;

        if (
          event.nativeEvent instanceof SubmitEvent &&
          (button = event.nativeEvent.submitter) &&
          (button instanceof HTMLButtonElement || button instanceof HTMLInputElement) &&
          button.setCustomValidity
        ) {
          const errorString = [...errors.entries()]
            .flatMap(([field, errors]) =>
              errors.map((error) => {
                return options.localizeError?.(error, field) ?? error;
              }),
            )
            .join('\n');

          button.setCustomValidity(errorString);
        }

        event.currentTarget.reportValidity();

        if (isValid) {
          formProps.onSubmit?.(event);
        }
      }}
    />
  );
}

function getField<TDraft, TOriginal extends TDraft, TPath extends PathAsString<TDraft>>(
  derivedState: Store<FormDerivedState<TDraft>>,
  original: TOriginal | undefined,
  path: TPath,
): Field<TDraft, TOriginal, TPath> {
  return {
    get originalValue() {
      return original !== undefined ? get(original as any, path as any) : undefined;
    },

    get value() {
      const { draft } = derivedState.get();
      return get(draft, path);
    },

    setValue(update) {
      derivedState.set(`draft.${path}` as any, update);
    },

    get hasChange() {
      return !deepEqual(this.originalValue, this.value);
    },

    get errors() {
      const { errors } = derivedState.get();
      return errors.get(path) ?? [];
    },

    get names() {
      const { value } = this;
      return (Array.isArray(value) ? value.map((_, index) => `${path}.${index}`) : []) as any;
    },

    append(...elements: any[]) {
      this.setValue((value) => (Array.isArray(value) ? [...value, ...elements] : elements) as any);
    },

    remove(index) {
      this.setValue(
        (value) =>
          (Array.isArray(value)
            ? [...value.slice(0, index), ...value.slice(index + 1)]
            : value) as any,
      );
    },
  };
}

function getErrors<TDraft, TOriginal>(
  draft: TDraft,
  original: TOriginal | undefined,
  validations: FormOptions<TDraft, TOriginal>['validations'],
) {
  const errors = new Map<string, string[]>();

  for (const [path, block] of Object.entries(validations ?? {})) {
    for (const [validationName, validate] of Object.entries(
      block as Record<string, Validation<any, any, any>>,
    )) {
      let matched = false;

      for (const [field, value] of Object.entries(getWildCardMatches(draft, path))) {
        matched = true;
        if (!validate(value, { draft, original, field })) {
          const fieldErrors = errors.get(field) ?? [];
          fieldErrors.push(validationName);
          errors.set(field, fieldErrors);
        }
      }

      if (!matched && !path.includes('*')) {
        if (!validate(undefined, { draft, original, field: path })) {
          const fieldErrors = errors.get(path) ?? [];
          fieldErrors.push(validationName);
          errors.set(path, fieldErrors);
        }
      }
    }
  }

  return errors;
}

export class Form<TDraft, TOriginal extends TDraft = TDraft> {
  context = createContext<FormContext<TDraft, TOriginal> | null>(null);

  constructor(public readonly options: FormOptions<TDraft, TOriginal>) {
    autobind(Form);
  }

  useForm(): FormContext<TDraft, TOriginal> {
    const context = useContext(this.context);

    if (!context) {
      throw new Error('Form context not found');
    }

    return context;
  }

  useFormState<S>(
    selector: (state: FormInstance<TDraft, TOriginal>) => S,
    useStoreOptions?: UseStoreOptions,
  ) {
    const form = this.useForm();

    return useStore(
      form.derivedState.map((state) =>
        selector({
          ...form,
          ...state,
        }),
      ),
      useStoreOptions,
    );
  }

  useField<TPath extends PathAsString<TDraft>>(path: TPath, useStoreOptions?: UseStoreOptions) {
    return this.useFormState((form) => form.getField(path), useStoreOptions);
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
    autoSave,
    transform,
    ...formProps
  }: {
    original?: TOriginal;
  } & Partial<FormOptions<TDraft, TOriginal>> &
    Omit<HTMLProps<HTMLFormElement>, 'defaultValue' | 'autoSave'>) {
    const options: FormOptions<TDraft, TOriginal> = {
      defaultValue: { ...this.options.defaultValue, ...defaultValue },
      validations: { ...this.options.validations, ...validations } as Validations<
        TDraft,
        TOriginal
      >,
      localizeError: localizeError ?? this.options.localizeError,
      autoSave: autoSave ?? this.options.autoSave,
      transform: transform ?? this.options.transform,
    };

    const formState = useMemo(() => {
      return createStore<FormState<TDraft>>({
        draft: undefined,
        hasTriggeredValidations: false,
        saveScheduled: false,
        saveInProgress: false,
      });
    }, []);

    const derivedState = useMemo(() => {
      return formState.map<FormDerivedState<TDraft>>(
        (state) => {
          const {
            draft = original ?? options.defaultValue,
            hasTriggeredValidations,
            saveScheduled,
            saveInProgress,
          } = state;
          const errors = getErrors(draft, original, options.validations);

          return {
            draft,
            hasTriggeredValidations,
            saveScheduled,
            saveInProgress,
            hasChanges: !!draft && !deepEqual(draft, original),
            errors,
            isValid: errors.size === 0,
          };
        },
        (newState) => ({
          draft: newState.draft,
          hasTriggeredValidations: newState.hasTriggeredValidations,
          saveScheduled: newState.saveScheduled,
          saveInProgress: newState.saveInProgress,
        }),
      );
    }, [formState, original, options.validations, options.defaultValue]);

    const context = useMemo(() => {
      return {
        formState,
        derivedState,
        options,
        original,

        getField(path) {
          return getField(derivedState, original, path);
        },

        getDraft() {
          return formState.get().draft ?? original ?? options.defaultValue;
        },

        hasTriggeredValidations() {
          return formState.get().hasTriggeredValidations;
        },

        hasChanges() {
          return derivedState.get().hasChanges;
        },

        getErrors() {
          return derivedState.get().errors;
        },

        isValid() {
          return derivedState.get().isValid;
        },

        validate() {
          formState.set('hasTriggeredValidations', true);
          return derivedState.get().isValid;
        },

        reset() {
          formState.set('draft', undefined);
          formState.set('hasTriggeredValidations', false);
        },
      } satisfies FormContext<TDraft, TOriginal>;
    }, [formState, derivedState, original, defaultValue, validations, localizeError, urlState]);

    useEffect(() => {
      if (urlState) {
        return connectUrl(
          formState.map('draft'),
          typeof urlState === 'object' ? urlState : { key: 'form' },
        );
      }

      return undefined;
    }, [formState, hash(urlState)]);

    useEffect(() => {
      const handles = options.transform?.map(({ trigger, update }) => {
        const draft = derivedState.map('draft');
        const triggerStore = trigger ? draft.map(trigger as any) : draft;

        return triggerStore.subscribe(() => {
          const value = trigger ? get(draft.get(), trigger as any) : draft.get();
          const result = update(value as any, draft);

          if (result !== undefined) {
            draft.set(result);
          }
        });
      });

      return () => {
        handles?.forEach((handle) => handle());
      };
    }, [options.transform]);

    useFormAutosave(context);

    return (
      <this.context.Provider value={context}>
        <FormContainer {...formProps} form={this} />
      </this.context.Provider>
    );
  }

  FormState<S>({
    selector,
    children,
  }: {
    selector: (form: FormInstance<TDraft, TOriginal>) => S;
    children: (selectedState: S) => ReactNode;
  }) {
    const selectedState = this.useFormState(selector);
    return <>{children(selectedState)}</>;
  }

  Field<
    const TPath extends PathAsString<TDraft>,
    const TComponent extends FormFieldComponent = (
      props: ComponentPropsWithoutRef<'input'> & { name: TPath },
    ) => JSX.Element,
  >(props: FormFieldProps<TDraft, TPath, TComponent>): JSX.Element;

  Field<TPath extends PathAsString<TDraft>>(
    props: Omit<FormFieldProps<TDraft, TPath, () => ReactNode>, 'component'>,
  ): JSX.Element;

  Field<TPath extends PathAsString<TDraft>>(
    props: Omit<FormFieldProps<TDraft, TPath, 'input'>, 'component' | 'render'>,
  ): JSX.Element;

  Field(props: any): JSX.Element {
    return Reflect.apply(FormField, this, [{ component: 'input', ...props }]);
  }

  ArrayField<TPath extends ArrayPath<TDraft>>(props: FormArrayFieldProps<TDraft, TPath>) {
    return Reflect.apply(FormArrayField, this, [props]);
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
