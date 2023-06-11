import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { createForm } from '../../src/react';

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

          <button />
        </form.Form>
      );
    }

    render(<Component />);
    const firstNameInput = screen.getByRole<HTMLInputElement>('textbox', { name: 'first name' });
    const firstNameErrors = screen.getByTestId('firstName-errors');
    const lastNameInput = screen.getByRole<HTMLInputElement>('textbox', { name: 'last name' });
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
