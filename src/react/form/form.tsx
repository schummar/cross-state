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
import useLatestFunction from '@react/lib/useLatestFunction';
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
  type FormFieldComponentProps,
  type FormFieldInfos,
  type FormFieldPropsWithComponent,
  type FormFieldPropsWithRender,
} from './formField';
import { FormForEach, type ElementName, type FormForEachProps } from './formForEach';
import { useFormAutosave, type FormAutosaveOptions } from './useFormAutosave';

/// /////////////////////////////////////////////////////////////////////////////
// Form types
/// /////////////////////////////////////////////////////////////////////////////

export interface Transform<TDraft> {
  (value: TDraft, store: Store<TDraft>): void | TDraft;
}

export interface FormOptions<TDraft, TOriginal> {
  defaultValue: TDraft;
  validations?: Validations<TDraft, TOriginal>;
  localizeError?: (error: string, field: string) => string | undefined;
  autoSave?: FormAutosaveOptions<TDraft, TOriginal>;
  transform?: Transform<TDraft>;
  validatedClass?: string;
  original?: TOriginal;
  onSubmit?: (event: FormEvent<HTMLFormElement>, form: FormInstance<TDraft, TOriginal>) => void;
  reportValidity?: boolean;
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
  options: FormOptions<TDraft, TOriginal>;
  original: TOriginal | undefined;
  getField: <TPath extends string>(path: TPath) => Field<TDraft, TOriginal, TPath>;
  getDraft: () => TDraft;
  hasTriggeredValidations: () => boolean;
  saveScheduled: () => boolean;
  saveInProgress: () => boolean;
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
  onSubmit?: (
    event: FormEvent<HTMLFormElement>,
    form: FormInstance<any, any>,
  ) => void | Promise<void>;
} & Omit<HTMLProps<HTMLFormElement>, 'form' | 'onSubmit'>) {
  const formInstance = form.useForm();
  const hasTriggeredValidations = form.useFormState((state) => state.hasTriggeredValidations);
  const hasErrors = form.useFormState((state) => hasTriggeredValidations && state.errors.size > 0);

  const formRef = useRef<HTMLFormElement>(null);

  const updateValidity = useLatestFunction(
    (errors: Map<string, string[]>, buttonElement?: HTMLButtonElement) => {
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
    },
  );

  useEffect(() => {
    return formInstance.formState
      .map(() => formInstance.getErrors())
      .subscribe((errors) => updateValidity(errors));
  }, [formInstance, updateValidity]);

  return (
    <form
      ref={formRef}
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

          const formElement = event.currentTarget;
          const buttonElement =
            event.nativeEvent instanceof SubmitEvent &&
            event.nativeEvent.submitter instanceof HTMLButtonElement
              ? event.nativeEvent.submitter
              : undefined;

          updateValidity(formInstance.getErrors(), buttonElement);

          if (formInstance.options.reportValidity) {
            formElement.reportValidity();
          }

          const isValid = formInstance.validate();
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
}

function getField<TDraft, TOriginal extends TDraft, TPath extends string>(
  form: FormContext<TDraft, TOriginal>,
  path: TPath,
): Field<TDraft, TOriginal, TPath> {
  const field = {
    get originalValue() {
      return form.original !== undefined ? get(form.original as any, path as any) : undefined;
    },

    get value() {
      const draft = form.getDraft();
      return get(draft ?? form.original ?? form.options.defaultValue, path as any);
    },

    setValue(update: Update<Value<TDraft, TPath>>) {
      form.formState.set('draft', (draft = form.original ?? form.options.defaultValue) => {
        if (update instanceof Function) {
          update = update(get(draft, path as any) as Value<TDraft, TPath>);
        }

        return set(draft, path as any, update as any);
      });
    },

    get hasChange() {
      return !deepEqual(this.originalValue, this.value, { undefinedEqualsAbsent: true });
    },

    get errors() {
      const errors = form.getErrors();
      return errors.get(path) ?? [];
    },

    get names(): any {
      const { value } = this;

      if (isObject(value)) {
        return Object.keys(value).map((key) => join(path, key));
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
  original: TOriginal | undefined,
  validations: FormOptions<TDraft, TOriginal>['validations'],
) {
  const errors = new Map<string, string[]>();

  if (typeof validations === 'function') {
    const issues = validations({ draft, original });

    for (const { name, error } of issues) {
      const fieldErrors = errors.get(name) ?? [];
      fieldErrors.push(error);
      errors.set(name, fieldErrors);
    }

    return errors;
  }

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

export function getDerivedState<TDraft>(
  instance: FormContext<TDraft, any>,
): FormDerivedState<TDraft> {
  return {
    draft: instance.getDraft(),
    hasTriggeredValidations: instance.hasTriggeredValidations(),
    saveScheduled: instance.saveScheduled(),
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
    defaultValue,
    validations,
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
      reportValidity: reportValidity ?? this.options.reportValidity ?? true,
      transformFieldProps: transformFieldProps ?? this.options.transformFieldProps,
    };

    const formState = useMemo(() => {
      return createStore<FormState<TDraft>>({
        draft: undefined,
        hasTriggeredValidations: false,
        saveScheduled: false,
        saveInProgress: false,
      });
    }, []);

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

      saveScheduled() {
        return formState.get().saveScheduled;
      },

      saveInProgress() {
        return formState.get().saveInProgress;
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
        return lazy('getErrors', () =>
          getErrors(this.getDraft(), options.original, options.validations),
        );
      },

      isValid() {
        return lazy('isValid', () => this.getErrors().size === 0);
      },

      validate() {
        formState.set('hasTriggeredValidations', true);
        return this.isValid();
      },

      reset() {
        formState.set('draft', undefined);
        formState.set('hasTriggeredValidations', false);
      },
    };

    context.getField = (path) => lazy(path, () => getField(context, path));

    useEffect(() => {
      const transform = options.transform;
      if (!transform) {
        return;
      }

      const store = formState.map(
        (state) => state.draft ?? options.original ?? options.defaultValue,
        (draft) => (state) => ({ ...state, draft }),
      );

      return store.subscribe((value) => {
        const result = transform(value, store);

        if (result !== undefined && !deepEqual(result, value)) {
          store.set(result);
        }
      });
    }, [options.defaultValue, options.original, options.transform, formState]);

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
  }): React.JSX.Element {
    const selectedState = this.useFormState(selector);
    return <>{children(selectedState)}</>;
  }

  Field<const TPath extends string>(
    props: FormFieldPropsWithRender<TDraft, TOriginal, TPath>,
  ): React.JSX.Element;

  Field<const TPath extends string, const TComponent extends FormFieldComponent = 'input'>(
    props: FormFieldPropsWithComponent<TDraft, TOriginal, TPath, TComponent>,
  ): React.JSX.Element;

  Field(props: any): React.JSX.Element {
    return Reflect.apply(FormField, this, [{ component: 'input', ...props }]);
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
