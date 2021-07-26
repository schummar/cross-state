import { createSelector, SelectorPaths, SelectorValue, setWithSelector } from '../helpers/stringSelector';
import { Form } from './form';

export type useFieldReturnType<T, Name extends SelectorPaths<T>> = [
  value: SelectorValue<T, Name>,
  setValue: (value: SelectorValue<T, Name>) => void,
  state: {
    isDirty: boolean;
    error?: unknown;
  }
];

export function useField<T, Name extends SelectorPaths<T>>(form: Form<T>, name: Name): useFieldReturnType<T, Name> {
  const selector = createSelector(name);
  const { value, isDirty, error } = form.state.useState((state) => {
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
    (value) => form.state.update((state) => setWithSelector(state.dirtyValue, name, value)),
    {
      isDirty,
      error,
    },
  ];
}
