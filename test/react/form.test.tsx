import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { createForm } from '../../src/react';

describe('form', () => {
  test('create form', async () => {
    const form = createForm<{
      firstName: string;
      lastName: string;
      age?: number;
      birthday?: Date;
      arr1: string[];
      arr2: string[];
    }>({
      defaultValue: { firstName: '', lastName: '', arr1: [], arr2: ['', ''] },
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
          <form.Field name="firstName" aria-label="first name" />
          <div data-testid="firstName-errors">
            <form.Error name="firstName" />
          </div>

          <form.Field
            name="lastName"
            component={(props) => <input {...props} />}
            aria-label="last name"
          />
          <div data-testid="lastName-errors">
            <form.Error name="lastName" />
          </div>

          <form.Field name="age" deserialize={Number}>
            {(props) => <input {...props} />}
          </form.Field>

          <form.Field name="birthday" component={DatePicker} />

          <form.Field name="age" component={CustomInput} />

          <button />

          <form.Subscribe selector={(form) => form.errors}>
            {(errors) => <div data-testid="all-errors" data-errors={JSON.stringify(errors)} />}
          </form.Subscribe>
        </form.Form>
      );
    }

    render(<Component />);
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
      { error: 'required', field: 'firstName' },
      { error: 'length', field: 'arr1' },
      { error: 'required', field: 'arr2.0' },
      { error: 'required', field: 'arr2.1' },
      { error: 'stuff', field: 'custom' },
      { error: 'required', field: 'lastName' },
      { error: 'different', field: 'lastName' },
    ]);
  });
});

function CustomInput(_props: { name: 'age'; value?: number; onChange: (value: number) => void }) {
  return null;
}
