import { createStore, type Store, type Update } from '@core';
import { autobind } from '@lib/autobind';
import { deepEqual } from '@lib/equals';
import { isObject } from '@lib/helpers';
import {
  type PathAsString,
  type Value,
  type WildcardPathAsString,
  type WildcardValue,
} from '@lib/path';
import { get, join, set } from '@lib/propAccess';
import type { Object_ } from '@lib/typeHelpers';
import { getWildCardMatches } from '@lib/wildcardMatch';
import { GeneralFormContext } from '@react/form/closestFormContext';
import { LegacyFormField, type FormFieldPropsWithComponent } from '@react/form/legacyFormField';
import { create, type Draft } from 'mutative';
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type Context,
  type FormEvent,
  type ForwardedRef,
  type FunctionComponent,
  type HTMLProps,
  type ReactNode,
} from 'react';
import { useStore, type UseStoreOptions } from '../useStore';
import {
  FormField,
  useFormFieldProps,
  type FormFieldComponent,
  type FormFieldComponentProps,
  type FormFieldInfos,
  type FormFieldProps,
  type FormFieldPropsWithChildren,
  type FormFieldPropsWithRender,
} from './formField';
import { FormForEach, type ElementName, type FormForEachProps } from './formForEach';
import { useFormAutosave, type FormAutosaveOptions } from './useFormAutosave';

/// /////////////////////////////////////////////////////////////////////////////
// Form types
/// /////////////////////////////////////////////////////////////////////////////

export interface Transform<TDraft, TOriginal> {
  (value: Draft<TDraft>, form: FormContext<TDraft, TOriginal>): void | TDraft;
}

export interface FormOptions<TDraft, TOriginal> {
  id?: string;
  defaultValue: TDraft;
  validations?: Validations<TDraft, TOriginal>;
  initiallyTriggerValidations?: boolean;
  localizeError?: (error: string, field: string) => string | undefined;
  autoSave?: FormAutosaveOptions<TDraft, TOriginal>;
  transform?: Transform<TDraft, TOriginal>;
  validatedClass?: string;
  original?: TOriginal;
  onSubmit?: (event: FormEvent<HTMLFormElement>, form: FormInstance<TDraft, TOriginal>) => void;
  reportValidity?: boolean | 'browser' | 'scrollTo';
  transformFieldProps?: <TPath extends string>(
    props: FormFieldComponentProps<Value<TDraft, TPath>, TPath>,
    info: FormFieldInfos<TDraft, TOriginal, TPath>,
    form: FormContext<TDraft, TOriginal>,
  ) => FormFieldComponentProps<Value<TDraft, TPath>, TPath>;
}

export type Validations<TDraft, TOriginal> =
  | ((context: { draft: TDraft; original: TOriginal | undefined }) => Iterable<{
      name: string;
      error: string;
    }>)
  | ({
      [TPath in WildcardPathAsString<TDraft>]?: Record<
        string,
        Validation<TDraft, TOriginal, TPath>
      >;
    } & Record<string, Record<string, Validation<TDraft, TOriginal, any>>>);

export type Validation<TDraft, TOriginal, TPath> = (
  value: WildcardValue<TDraft, TPath>,
  context: {
    draft: TDraft;
    original: TOriginal;
    field: PathAsString<TDraft> | '';
  },
) => boolean;

export type Field<TDraft, TOriginal, TPath extends string> = {
  originalValue: Value<TOriginal, TPath> | undefined;
  value: Value<TDraft, TPath>;
  setValue: (value: Update<Value<TDraft, TPath>>) => void;
  removeValue: () => void;
  hasChange: boolean;
  errors: string[];
} & (Value<TDraft, TPath> extends Object_ ? FieldHelperMethods<TDraft, TPath> : {});

export type FieldHelperMethods<TDraft, TPath extends string> = {
  names: ElementName<TDraft, TPath>[];
  add: NonNullable<Value<TDraft, TPath>> extends readonly (infer T)[]
    ? (element: T) => void
    : NonNullable<Value<TDraft, TPath>> extends Record<infer K, infer V>
      ? (key: K, value: V) => void
      : never;
  remove: NonNullable<Value<TDraft, TPath>> extends readonly any[]
    ? (index: number) => void
    : (key: string) => void;
};

export interface FormState<TDraft> {
  draft: TDraft | undefined;
  hasTriggeredValidations: boolean;
  saveInProgress: boolean;
}

export interface FormDerivedState<TDraft> {
  draft: TDraft;
  hasTriggeredValidations: boolean;
  saveInProgress: boolean;
  hasChanges: boolean;
  errors: Map<string, string[]>;
  isValid: boolean;
}

export interface FormContext<TDraft, TOriginal> {
  formState: Store<FormState<TDraft>>;
  options: FormOptions<TDraft, TOriginal>;
  original: TOriginal | undefined;
  getField: <TPath extends string>(
    name: TPath extends PathAsString<TDraft> ? TPath : PathAsString<TDraft>,
    options?: FieldOptions,
  ) => Field<TDraft, TOriginal, TPath>;
  getDraft: () => TDraft;
  hasTriggeredValidations: () => boolean;
  saveInProgress: () => boolean;
  flushAutosave: () => Promise<void>;
  cancelAutosave: () => void;
  hasChanges: () => boolean;
  getErrors: () => Map<string, string[]>;
  isValid: () => boolean;
  validate: (options?: ValidateOptions) => boolean;
  reset: () => void;
}

export interface FieldOptions {
  includeNestedErrors?: boolean;
}

export interface ValidateOptions {
  reportValidity?: boolean | 'browser' | 'scrollTo';
  button?: HTMLButtonElement;
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

const FormContainer = forwardRef(function FormContainer(
  {
    form,
    ...formProps
  }: {
    form: Form<any, any>;
    onSubmit?: (
      event: FormEvent<HTMLFormElement>,
      form: FormInstance<any, any>,
    ) => void | Promise<void>;
  } & Omit<HTMLProps<HTMLFormElement>, 'form' | 'onSubmit'>,
  ref: ForwardedRef<HTMLFormElement>,
) {
  const formInstance = form.useForm();
  const hasTriggeredValidations = form.useFormState((state) => state.hasTriggeredValidations);
  const hasErrors = form.useFormState((state) => hasTriggeredValidations && state.errors.size > 0);

  return (
    <form
      ref={ref}
      noValidate
      {...formProps}
      className={[
        formProps.className,
        hasTriggeredValidations ? (formInstance.options.validatedClass ?? 'validated') : undefined,
      ]
        .filter(Boolean)
        .join(' ')}
      data-validated={hasTriggeredValidations || undefined}
      data-valid={hasErrors ? 'false' : hasTriggeredValidations ? 'true' : undefined}
      onSubmit={async (event) => {
        if (formInstance.saveInProgress()) {
          return;
        }

        try {
          formInstance.formState.set('saveInProgress', true);
          event.preventDefault();

          const button =
            event.nativeEvent instanceof SubmitEvent &&
            event.nativeEvent.submitter instanceof HTMLButtonElement
              ? event.nativeEvent.submitter
              : undefined;

          const isValid = formInstance.validate({ button });
          if (isValid) {
            await formProps.onSubmit?.(event, {
              ...formInstance,
              ...getDerivedState(formInstance),
            });
          }
        } finally {
          formInstance.formState.set('saveInProgress', false);
        }
      }}
    />
  );
});

function getField<TDraft, TOriginal extends TDraft, TPath extends string>(
  form: FormContext<TDraft, TOriginal>,
  name: TPath extends PathAsString<TDraft> ? TPath : PathAsString<TDraft>,
  { includeNestedErrors }: FieldOptions = {},
): Field<TDraft, TOriginal, TPath> {
  const field = {
    get originalValue() {
      return form.original !== undefined ? get(form.original as any, name as any) : undefined;
    },

    get value() {
      const draft = form.getDraft();
      return get(draft ?? form.original ?? form.options.defaultValue, name as any);
    },

    setValue(update: Update<Value<TDraft, TPath>>) {
      form.formState.set('draft', (draft = form.original ?? form.options.defaultValue) => {
        if (update instanceof Function) {
          update = update(get(draft, name as any) as Value<TDraft, TPath>);
        }

        return set(draft, name as any, update as any);
      });
    },

    get hasChange() {
      return !deepEqual(this.originalValue, this.value, { undefinedEqualsAbsent: true });
    },

    get errors() {
      const errors = form.getErrors();

      if (includeNestedErrors) {
        return Array.from(errors.entries())
          .filter(([key]) => key === name || key.startsWith(`${name}.`))
          .flatMap(([, value]) => value);
      } else {
        return errors.get(name) ?? [];
      }
    },

    get names(): any {
      const { value } = this;

      if (isObject(value)) {
        return Object.keys(value).map((key) => join(name, key));
      }

      return [];
    },

    add(...args: any[]) {
      this.setValue((value): any => {
        if (!value) {
          throw new Error(`Cannot add element to ${JSON.stringify(value)}`);
        }

        if (Array.isArray(value)) {
          return [...(value ?? []), args[0]];
        }

        if (isObject(value)) {
          return {
            ...value,
            [args[0]]: args[1],
          };
        }

        throw new Error(`Cannot add element to ${JSON.stringify(value)}`);
      });
    },

    remove(key: string | number) {
      this.setValue((value): any => {
        if (!value) {
          throw new Error(`Cannot remove element from ${JSON.stringify(value)}`);
        }

        if (Array.isArray(value)) {
          return value.filter((_, index) => index !== Number(key));
        }

        if (isObject(value)) {
          const { [key]: _, ...rest } = value as Record<string | number, unknown>;
          return rest;
        }

        throw new Error(`Cannot remove element from ${JSON.stringify(value)}`);
      });
    },
  };

  return field as any;
}

function getErrors<TDraft, TOriginal>(
  draft: TDraft,
  { original, validations, localizeError }: FormOptions<TDraft, TOriginal>,
) {
  const errors = new Map<string, string[]>();

  if (typeof validations === 'function') {
    const issues = validations({ draft, original });

    for (const { name, error } of issues) {
      const fieldErrors = errors.get(name) ?? [];
      fieldErrors.push(error);
      errors.set(name, fieldErrors);
    }
  } else {
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
  }

  if (localizeError) {
    for (const [field, fieldErrors] of errors.entries()) {
      errors.set(
        field,
        fieldErrors.map((error) => localizeError(error, field) ?? error),
      );
    }
  }

  return errors;
}

export function getDerivedState<TDraft>(
  instance: FormContext<TDraft, any>,
): FormDerivedState<TDraft> {
  return {
    draft: instance.getDraft(),
    hasTriggeredValidations: instance.hasTriggeredValidations(),
    saveInProgress: instance.saveInProgress(),
    hasChanges: instance.hasChanges(),
    errors: instance.getErrors(),
    isValid: instance.isValid(),
  };
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
      form.formState,
      () =>
        selector({
          ...form,
          ...getDerivedState(form),
        }),

      useStoreOptions,
    );
  }

  useField<TPath extends string>(
    name: TPath extends PathAsString<TDraft> ? TPath : PathAsString<TDraft>,
    { includeNestedErrors, ...useStoreOptions }: FieldOptions & UseStoreOptions<unknown> = {},
  ): Field<TDraft, TOriginal, TPath> {
    const form = this.useForm();
    this.useFormState((form) => [form.getField(name).value, form.original], useStoreOptions);

    return form.getField(name, { includeNestedErrors });
  }

  useFieldProps<TPath extends string>(
    name: TPath extends PathAsString<TDraft> ? TPath : PathAsString<TDraft>,
    options?: Omit<FormFieldProps<TPath, TDraft>, 'name'>,
  ): FormFieldComponentProps<Value<TDraft, TPath>, TPath> {
    return useFormFieldProps.call<
      Form<TDraft, TOriginal>,
      [FormFieldProps<TPath, TDraft>],
      FormFieldComponentProps<Value<TDraft, TPath>, TPath>
    >(this, { name, ...options } as any);
  }

  // ///////////////////////////////////////////////////////////////////////////
  // React Components
  // ///////////////////////////////////////////////////////////////////////////

  Form({
    defaultValue,
    validations,
    initiallyTriggerValidations,
    localizeError,
    autoSave,
    transform,
    validatedClass,
    original,
    onSubmit,
    reportValidity,
    transformFieldProps,
    ...formProps
  }: Partial<FormOptions<TDraft, TOriginal>> &
    Omit<HTMLProps<HTMLFormElement>, 'defaultValue' | 'autoSave' | 'onSubmit'>): React.JSX.Element {
    const options: FormOptions<TDraft, TOriginal> = {
      defaultValue: { ...this.options.defaultValue, ...defaultValue },
      validations:
        typeof validations === 'function'
          ? validations
          : validations
            ? ({ ...this.options.validations, ...validations } as Validations<TDraft, TOriginal>)
            : this.options.validations,
      localizeError: localizeError ?? this.options.localizeError,
      autoSave: autoSave ?? this.options.autoSave,
      transform: transform ?? this.options.transform,
      validatedClass: validatedClass ?? this.options.validatedClass,
      original: original ?? this.options.original,
      onSubmit: onSubmit ?? this.options.onSubmit,
      reportValidity: reportValidity ?? this.options.reportValidity ?? 'browser',
      transformFieldProps: transformFieldProps ?? this.options.transformFieldProps,
    };

    const formState = useMemo(() => {
      return createStore<FormState<TDraft>>({
        draft: undefined,
        hasTriggeredValidations: initiallyTriggerValidations ?? false,
        saveInProgress: false,
      });
      // oxlint-disable-next-line exhaustive-deps
    }, []);

    const formRef = useRef<HTMLFormElement>(null);

    let lastDraft: TDraft | undefined;
    const cache = new Map<string, unknown>();
    function lazy<T>(key: string, fn: () => T): T {
      if (lastDraft !== formState.get().draft) {
        cache.clear();
        lastDraft = formState.get().draft;
      }

      let value = cache.get(key);
      if (!cache.has(key)) {
        value = fn();
        cache.set(key, value);
      }

      return value as T;
    }

    const context: FormContext<TDraft, TOriginal> = {
      formState,
      options,
      original: options.original,

      getField() {
        throw new Error('Not implemented');
      },

      getDraft() {
        return formState.get().draft ?? options.original ?? options.defaultValue;
      },

      hasTriggeredValidations() {
        return formState.get().hasTriggeredValidations;
      },

      saveInProgress() {
        return formState.get().saveInProgress;
      },

      flushAutosave() {
        return autosave.flush();
      },

      cancelAutosave() {
        return autosave.cancel();
      },

      hasChanges() {
        return lazy(
          'hasChanges',
          () =>
            !deepEqual(this.getDraft(), options.original ?? options.defaultValue, {
              undefinedEqualsAbsent: true,
            }),
        );
      },

      getErrors() {
        return lazy('getErrors', () => getErrors(this.getDraft(), options));
      },

      isValid() {
        return lazy('isValid', () => this.getErrors().size === 0);
      },

      validate({ reportValidity = options.reportValidity, button }: ValidateOptions = {}) {
        formState.set('hasTriggeredValidations', true);

        updateValidity(this.getErrors(), button);

        switch (reportValidity) {
          case 'browser':
            formRef.current?.reportValidity();
            break;

          case true:
          case 'scrollTo':
            {
              const invalidElement = document.querySelector(':invalid, [data-invalid="true"]');
              if (invalidElement && invalidElement instanceof HTMLElement) {
                invalidElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                invalidElement.focus({ preventScroll: true });
              }
            }
            break;
        }

        return this.isValid();
      },

      reset() {
        formState.set('draft', undefined);
        formState.set('hasTriggeredValidations', false);
      },
    };

    context.getField = (path, options) =>
      lazy(`${path}:${options?.includeNestedErrors}`, () => getField(context, path, options));

    useEffect(() => {
      const transform = options.transform;
      if (!transform) {
        return;
      }

      return context.formState.subscribe((state) => {
        const value = state.draft ?? options.original ?? options.defaultValue;
        const result = create(value, (draft) => transform(draft, context)) as TDraft;

        if (!deepEqual(result, value)) {
          context.formState.set('draft', result);
        }
      });
    });

    function updateValidity(errors: Map<string, string[]>, buttonElement?: HTMLButtonElement) {
      const formElement = formRef.current;
      if (!formElement) {
        return;
      }

      for (const element of Array.from(formElement.elements)) {
        if ('name' in element && 'setCustomValidity' in element) {
          (element as HTMLObjectElement).setCustomValidity(
            errors.get((element as HTMLObjectElement).name)?.join('\n') ?? '',
          );
        }
      }

      if (buttonElement && 'setCustomValidity' in buttonElement) {
        const errorString = [...errors.values()].flat().join('\n');

        buttonElement.setCustomValidity(errorString);
      }
    }

    useEffect(() => {
      return formState.map(() => context.getErrors()).subscribe((errors) => updateValidity(errors));
    });

    const autosave = useFormAutosave(context);

    return (
      <GeneralFormContext.Provider value={this}>
        <this.context.Provider value={context}>
          <FormContainer {...formProps} form={this} onSubmit={options.onSubmit} />
        </this.context.Provider>
      </GeneralFormContext.Provider>
    );
  }

  FormState<S>({
    selector,
    children,
  }: {
    selector: (form: FormInstance<TDraft, TOriginal>) => S;
    children: (selectedState: S) => ReactNode;
  }): React.JSX.Element {
    const selectedState = this.useFormState(selector);
    return <>{children(selectedState)}</>;
  }

  Field<const TPath extends string>(
    props: FormFieldPropsWithRender<TDraft, TOriginal, TPath>,
  ): React.JSX.Element;

  Field<const TPath extends string>(
    props: FormFieldPropsWithChildren<TDraft, TOriginal, TPath>,
  ): React.JSX.Element;

  /** @deprecated */
  Field<const TPath extends string, const TComponent extends FormFieldComponent = 'input'>(
    props: FormFieldPropsWithComponent<TDraft, TOriginal, TPath, TComponent>,
  ): React.JSX.Element;

  Field(props: any): React.JSX.Element {
    if (props.component) {
      return Reflect.apply(LegacyFormField, this, [props]);
    }

    return Reflect.apply(FormField, this, [props]);
  }

  ForEach<const TPath extends string>(props: FormForEachProps<TDraft, TPath>): React.JSX.Element {
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
