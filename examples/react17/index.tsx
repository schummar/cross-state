import { createForm } from 'cross-state/react';

const { Field } = createForm({
  defaultValue: {
    name: 'abc',
  },
});

export function Test() {
  return (
    <>
      <Field name="name" render={(props) => props.value} />
    </>
  );
}
