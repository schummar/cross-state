import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { type FormInputComponent, createForm } from '../../src/react';

describe('form', () => {
  test('create form', async () => {
    const form = createForm<{ firstName: string; lastName: string; age?: number; birthday?: Date }>(
      {
        defaultValue: { firstName: '', lastName: '' },
        validations: {
          firstName: {
            required: (value) => !!value,
          },
        },
      },
    );

    function Button() {
      const { validate } = form.useForm();

      return <button onClick={validate}>Validate</button>;
    }

    const DatePicker: FormInputComponent<Date | undefined> = ({ value, onChange }) => {
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
        <form.Provider
          validations={{
            lastName: {
              required: (value) => !!value,
              different: (value, { draft }) => value !== draft.firstName,
            },
          }}
        >
          <form.Input name="firstName" type="text" />
          <div data-testid="firstName-errors">
            <form.Error name="firstName" />
          </div>

          <form.Input name="lastName" component={(props) => <input {...props} />}></form.Input>
          <div data-testid="lastName-errors">
            <form.Error name="lastName" />
          </div>

          <form.Input name="age" serialize={(x) => x ?? ''} deserialize={Number} />

          <form.Input name="birthday" component={DatePicker} />

          <Button />
        </form.Provider>
      );
    }

    render(<Component />);
    const firstNameInput = screen.getByRole<HTMLInputElement>('textbox', { name: 'firstName' });
    const firstNameErrors = screen.getByTestId('firstName-errors');
    const lastNameInput = screen.getByRole<HTMLInputElement>('textbox', { name: 'lastName' });
    const lastNameErrors = screen.getByTestId('lastName-errors');

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
  });
});
