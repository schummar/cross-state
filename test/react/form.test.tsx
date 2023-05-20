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

    function Button() {
      const { validate } = form.useForm();

      return <button onClick={validate}>Validate</button>;
    }

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
          <form.Input
            name="firstName"
            data-testid="firstName-input"
            component="input"
            // commitOnBlur
          />
          <form.Error name="firstName" data-testid="firstName-errors" component="div" />

          <form.Input
            name="lastName"
            data-testid="lastName-input"
            component={(props) => <input {...props} />}
          ></form.Input>
          <form.Error name="lastName" data-testid="lastName-errors" component="div" />

          <form.Input
            component="input"
            name="age"
            serialize={(x) => x ?? ''}
            deserialize={Number}
          />

          <form.Input
            component="input"
            name="birthday"
            serialize={(x) => x?.toISOString() ?? ''}
            deserialize={(x) => new Date(x)}
          />

          <Button />
        </form.Provider>
      );
    }

    render(<Component />);
    const firstNameInput = screen.getByTestId<HTMLInputElement>('firstName-input');
    const firstNameErrors = screen.getByTestId('firstName-errors');
    const lastNameInput = screen.getByTestId<HTMLInputElement>('lastName-input');
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
