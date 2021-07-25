import { castDraft } from 'immer';
import React, { createContext, ReactNode, useContext, useMemo } from 'react';
import { createSelector, SelectorPaths, SelectorValue, setWithSelector } from '../helpers/stringSelector';
import { Store } from '../react';

type State<T> = {
  value: T;
  dirtyValue: DeepPartial<T>;
  validations: (() => unknown)[];
  errors: Map<string, unknown>;
};

export class Form<T> {
  readonly context = createContext<Store<State<T>> | null>(null);

  constructor() {
    this.Field = this.Field.bind(this);
  }

  Provider = ({ children, value }: { children: ReactNode; value: T }): JSX.Element => {
    const store = useMemo(() => {
      const s = new Store<State<T>>({
        value,
        dirtyValue: {},
        validations: [],
        errors: new Map<string, unknown>(),
      });

      s.subscribe(
        (s) => s,
        (s) => console.log(s)
      );

      return s;
    }, []);

    store.update((state) => {
      state.value = castDraft(value);
    });

    return <this.context.Provider value={store}>{children}</this.context.Provider>;
  };

  private useForm(): Store<State<T>> {
    const form = useContext(this.context);
    if (!form) throw Error('No form context!');
    return form;
  }

  useField<Name extends SelectorPaths<T>>(
    name: Name
  ): [
    value: SelectorValue<T, Name>,
    setValue: (value: SelectorValue<T, Name>) => void,
    state: {
      isDirty: boolean;
      error?: unknown;
    }
  ] {
    const store = this.useForm();
    const selector = createSelector(name);
    const { value, isDirty, error } = store.useState((state) => {
      const fromValue = selector(state.value) as SelectorValue<T, Name>;
      const fromDirtyValue = selector(state.dirtyValue) as SelectorValue<T, Name> | undefined;

      return {
        value: fromDirtyValue ?? fromValue,
        isDirty: fromDirtyValue !== undefined,
        error: state.errors.get(name),
      };
    });

    return [
      value,
      (value) => store.update((state) => setWithSelector(state.dirtyValue, name, value)),
      {
        isDirty,
        error,
      },
    ];
  }

  Field<Name extends SelectorPaths<T>>({
    name,
    children,
  }: {
    name: Name;
    children: (props: { value: SelectorValue<T, Name>; onChange: (e: { target: { value: string } }) => void }) => JSX.Element;
  }): JSX.Element {
    const [value, setValue] = this.useField(name);
    return children({ value, onChange: (e) => setValue(e.target.value) });
  }
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Record<string, unknown> ? DeepPartial<T[P]> : T[P];
};
