import { connectUrl, createStore, type Store, type Update, type UrlStoreOptions } from '@core';
import { autobind } from '@lib/autobind';
import { deepEqual } from '@lib/equals';
import { simpleHash } from '@lib/hash';
import { isObject } from '@lib/helpers';
import {
  type Path,
  type PathAsString,
  type Value,
  type WildcardPathAsString,
  type WildcardValue,
} from '@lib/path';
import { get, join } from '@lib/propAccess';
import type { Object_ } from '@lib/typeHelpers';
import { getWildCardMatches } from '@lib/wildcardMatch';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type Context,
  type FormEvent,
  type FunctionComponent,
  type HTMLProps,
  type ReactNode,
} from 'react';
import { useStore, type UseStoreOptions } from '../useStore';
import {
  FormField,
  type FormFieldComponent,
  type FormFieldPropsWithComponent,
  type FormFieldPropsWithRender,
} from './formField';
import {
  FormForEach,
  type ElementName,
  type ForEachPath,
  type FormForEachProps,
} from './formForEach';
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
  validClass?: string;
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
  setValue: (value: Update<Value<TDraft, TPath>>) => void;
  hasChange: boolean;
  errors: string[];
} & (Value<TDraft, TPath> extends Object_ ? FieldHelperMethods<TDraft, TPath> : {});

export type FieldHelperMethods<TDraft, TPath extends PathAsString<TDraft>> = {
  names: ElementName<TDraft, TPath>[];
  add: NonNullable<Value<TDraft, TPath>> extends readonly (infer T)[]
    ? (element: T) => void
    : NonNullable<Value<TDraft, TPath>> extends Record<infer K, infer V>
      ? (key: K, value: V) => void
      : never;
  remove: Value<TDraft, TPath> extends readonly any[]
    ? (index: number) => void
    : (key: string) => void;
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
    Pick<
      FormContext<TDraft, TOriginal>,
      'options' | 'original' | 'getField' | 'validate' | 'reset'
    > {}

/// /////////////////////////////////////////////////////////////////////////////
// Implementation
/// /////////////////////////////////////////////////////////////////////////////

function FormContainer({
  form,
  ...formProps
}: {
  form: Form<any, any>;
  onSubmit?: (event: FormEvent<HTMLFormElement>, form: FormInstance<any, any>) => void;
} & Omit<HTMLProps<HTMLFormElement>, 'form' | 'onSubmit'>) {
  const formInstance = form.useForm();
  const hasTriggeredValidations = form.useFormState((state) => state.hasTriggeredValidations);

  const formRef = useRef<HTMLFormElement>(null);

  function updateValidity(errors: Map<string, string[]>, buttonElement?: HTMLButtonElement) {
    const formElement = formRef.current;
    if (!formElement) {
      return;
    }

    const localizedErrors = new Map(
      [...errors.entries()].map(
        ([field, errors]) =>
          [
            field,
            errors.map((error) => formInstance.options.localizeError?.(error, field) ?? error),
          ] as const,
      ),
    );

    for (const element of Array.from(formElement.elements)) {
      if ('name' in element && 'setCustomValidity' in element) {
        (element as HTMLObjectElement).setCustomValidity(
          localizedErrors.get((element as HTMLObjectElement).name)?.join('\n') ?? '',
        );
      }
    }

    if (buttonElement && 'setCustomValidity' in buttonElement) {
      const errorString = [...errors.values()].flat().join('\n');

      buttonElement.setCustomValidity(errorString);
    }
  }

  useEffect(() => {
    return formInstance.derivedState.map('errors').subscribe((errors) => updateValidity(errors));
  }, [formInstance.derivedState]);

  return (
    <form
      ref={formRef}
      noValidate
      {...formProps}
      className={[
        formProps.className,
        hasTriggeredValidations ? (form.options.validClass ?? 'validated') : undefined,
      ]
        .filter(Boolean)
        .join(' ')}
      onSubmit={(event) => {
        event.preventDefault();

        const formElement = event.currentTarget;
        const buttonElement =
          event.nativeEvent instanceof SubmitEvent &&
          event.nativeEvent.submitter instanceof HTMLButtonElement
            ? event.nativeEvent.submitter
            : undefined;

        updateValidity(formInstance.derivedState.get().errors, buttonElement);

        formElement.reportValidity();

        const isValid = formInstance.validate();
        if (isValid) {
          formProps.onSubmit?.(event, {
            ...formInstance,
            ...formInstance.derivedState.get(),
          });
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

    setValue(update: any) {
      derivedState.set(join('draft', path) as any, update);
    },

    get hasChange() {
      return !deepEqual(this.originalValue, this.value);
    },

    get errors() {
      const { errors } = derivedState.get();
      return errors.get(path) ?? [];
    },

    get names(): any {
      const { value } = this;

      if (Array.isArray(value)) {
        return value.map((_, index) => join(path, String(index)));
      }

      if (isObject(value)) {
        return Object.keys(value).map((key) => join(path, key));
      }

      return [];
    },

    add(...args: any[]) {
      this.setValue((value: any) => {
        if (args.length === 1) {
          return [...(value ?? []), args[0]];
        }

        return {
          ...value,
          [args[0]]: args[1],
        };
      });
    },

    remove(key: any) {
      this.setValue((value: any) => {
        if (!value) {
          return value;
        }

        if (Array.isArray(value)) {
          return value.filter((_, index) => index !== key);
        }

        if (isObject(value)) {
          const { [key]: _, ...rest } = value;
          return rest;
        }

        return value;
      });
    },
  } as any;
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
  context: Context<FormContext<TDraft, TOriginal> | null> = createContext<FormContext<
    TDraft,
    TOriginal
  > | null>(null);

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
    useStoreOptions?: UseStoreOptions<S>,
  ): S {
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

  useField<TPath extends PathAsString<TDraft>>(
    path: TPath,
    useStoreOptions?: UseStoreOptions<any>,
  ): Field<TDraft, TOriginal, TPath> {
    const form = this.useForm();
    this.useFormState((form) => [form.getField(path).value, form.original], useStoreOptions);
    return form.getField(path);
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
    onSubmit?: (event: FormEvent<HTMLFormElement>, form: FormInstance<TDraft, TOriginal>) => void;
  } & Partial<FormOptions<TDraft, TOriginal>> &
    Omit<HTMLProps<HTMLFormElement>, 'defaultValue' | 'autoSave' | 'onSubmit'>): JSX.Element {
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
            hasChanges: !deepEqual(draft, original ?? options.defaultValue),
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
    }, [formState, simpleHash(urlState)]);

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
  }): JSX.Element {
    const selectedState = this.useFormState(selector);
    return <>{children(selectedState)}</>;
  }

  Field<TPath extends PathAsString<TDraft> = ''>(
    props: FormFieldPropsWithRender<TDraft, TOriginal, TPath>,
  ): JSX.Element;

  Field<
    const TPath extends PathAsString<TDraft> = '',
    const TComponent extends FormFieldComponent = 'input',
  >(props: FormFieldPropsWithComponent<TDraft, TOriginal, TPath, TComponent>): JSX.Element;

  Field(props: any): JSX.Element {
    return Reflect.apply(FormField, this, [{ component: 'input', ...props }]);
  }

  ForEach<TPath extends ForEachPath<TDraft>>(props: FormForEachProps<TDraft, TPath>): JSX.Element {
    return Reflect.apply(FormForEach, this, [props]);
  }

  withForm<TProps extends Record<string, unknown>>(
    Component: React.ComponentType<TProps>,
    formProps?: Parameters<this['Form']>[0],
  ): FunctionComponent<TProps> {
    const { Form } = this;
    return function FormWrapper(props: TProps) {
      return (
        <Form {...formProps}>
          <Component {...props} />
        </Form>
      );
    };
  }
}

export function createForm<TDraft, TOriginal extends TDraft = TDraft>(
  options: FormOptions<TDraft, TOriginal>,
): Form<TDraft, TOriginal> {
  return new Form(options);
}
