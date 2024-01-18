import { MantineProvider, TextInput as MantineTextInput, SegmentedControl } from '@mantine/core';
import { TextField as MUITextField, TextField } from '@mui/material';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { forwardRef } from 'react';
import { describe, expect, test } from 'vitest';
import { createForm } from '../../src/react';
import type { Value } from '@index';

describe('form', () => {
  test('create form', async () => {
    const form = createForm<{
      firstName: string;
      lastName: string;
      age?: number;
      birthday?: Date;
      arr1: string[];
      arr2: string[];
      type: 'a' | 'b';
      record: Record<string, { arr: { x: 1 }[] }>;
      optional?: string;
      optionalNested?: { nested: string };
      nullish?: string | null;
    }>({
      defaultValue: {
        firstName: '',
        lastName: '',
        arr1: [],
        arr2: ['', ''],
        type: 'a',
        record: {},
      },
      validations: {
        firstName: {
          required: (value) => !!value,
        },
        arr1: {
          length: (value) => value.length > 0,
        },
        'arr1.*': {
          required: (value) => !!value,
        },
        'arr2.*': {
          required: (value) => !!value,
        },
        custom: {
          stuff: (_value, { draft }) => (draft.age ?? 0) >= 16,
        },
      },
    });

    const DatePicker = ({ value, onChange }: { value?: Date; onChange: (value: Date) => void }) => {
      return (
        <input
          type="date"
          value={value?.toISOString() ?? ''}
          onChange={(event) => onChange?.(new Date(event.target.value))}
        />
      );
    };

    function Component() {
      return (
        <form.Form
          validations={{
            lastName: {
              required: (value) => !!value,
              different: (value, { draft }) => value !== draft.firstName,
            },
          }}
        >
          <form.Field name="firstName" aria-label="first name" inputFilter={(x) => true} />
          <div data-testid="firstName-errors">
            <form.FormState
              selector={(form) =>
                form.hasTriggeredValidations ? form.errors.get('firstName') : undefined
              }
            >
              {(errors) => errors?.join(',')}
            </form.FormState>
          </div>

          <form.Field
            name="lastName"
            render={(props) => <input {...props} aria-label="last name" />}
          />

          <div data-testid="lastName-errors">
            <form.FormState
              selector={(form) =>
                form.hasTriggeredValidations ? form.errors.get('lastName') : undefined
              }
            >
              {(errors) => errors?.join(',')}
            </form.FormState>
          </div>

          <form.Field name="age" defaultValue={0} component={CustomInput} additionalProp="" />

          <form.Field name="firstName" component={MUITextField} size="small" variant="standard" />
          <form.Field name="firstName" component={MantineTextInput} />
          <form.Field name="firstName" component="input" />
          <form.Field name="firstName" component="textarea" />

          <form.Field
            name="type"
            component={SegmentedControl}
            data={['a', 'b']}
            deserialize={(x) => x as 'a' | 'b'}
          />

          <form.ForEach
            name="arr1"
            renderElement={({ name }) => <form.Field name={name} component={MUITextField} />}
          >
            {({ names }) => names.join(',')}
          </form.ForEach>

          <form.ForEach
            name="record"
            renderElement={({ name }) => <form.Field name={`${name}.x`} component={MUITextField} />}
          >
            {({ names }) => names.join(',')}
          </form.ForEach>

          <button />

          <form.FormState selector={(form) => form.errors}>
            {(errors) => <div data-testid="all-errors" data-errors={JSON.stringify([...errors])} />}
          </form.FormState>
        </form.Form>
      );
    }

    <form.Field name="birthday" render={(props) => <DatePicker {...props} />} />;

    // @ts-expect-error incompatible types => needs serializer/deserilizer
    <form.Field name="firstName" component={DatePicker} />;

    // @ts-expect-error needs additional props
    <form.Field name="age" component={CustomInput} />;

    <form.Field defaultValue="" name="optional" />;
    <form.Field serialize={(x) => x ?? ''} name="optional" />;
    <form.Field defaultValue="" serialize={(x) => x ?? ''} name="optional" />;
    // @ts-expect-error needs default value
    <form.Field name="optional" />;

    // @ts-expect-error needs default value
    <form.Field name="optionalNested.nested" />;

    render(
      <MantineProvider>
        <Component />
      </MantineProvider>,
    );
    const firstNameInput = screen.getByRole<HTMLInputElement>('textbox', { name: 'first name' });
    const firstNameErrors = screen.getByTestId('firstName-errors');
    const lastNameInput = screen.getByRole<HTMLInputElement>('textbox', { name: 'last name' });
    const lastNameErrors = screen.getByTestId('lastName-errors');
    const allErrors = screen.getByTestId('all-errors');

    act(() => {
      fireEvent.change(firstNameInput, { target: { value: 'Bruce' } });
    });

    expect(firstNameInput.value).toBe('Bruce');
    expect(firstNameErrors.textContent).toBe('');
    expect(lastNameInput.value).toBe('');
    expect(lastNameErrors.textContent).toBe('');

    act(() => {
      screen.getByRole('button').click();
    });

    expect(firstNameErrors.textContent).toBe('');
    expect(lastNameErrors.textContent).toBe('required');

    act(() => {
      fireEvent.change(lastNameInput, { target: { value: 'Bruce' } });
    });

    expect(lastNameErrors.textContent).toBe('different');

    expect(JSON.parse(allErrors.getAttribute('data-errors')!)).toEqual([
      ['arr1', ['length']],
      ['arr2.0', ['required']],
      ['arr2.1', ['required']],
      ['custom', ['stuff']],
      ['lastName', ['different']],
    ]);
  });
});

const CustomInput = forwardRef(function CustomInput(
  _props: {
    id?: string;
    name: 'age';
    value?: number;
    onChange: (value: number) => void;
    additionalProp: string;
  },
  ref,
) {
  return null;
});
