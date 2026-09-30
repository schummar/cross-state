import { createForm, type FormContext } from '../../src/react';
import type { FormAutosaveOptions } from '../../src/react/form/useFormAutosave';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vite-plus/test';

type Draft = { name: string };

function setup(autoSave: FormAutosaveOptions<Draft, Draft>) {
  const form = createForm<Draft>({
    defaultValue: { name: '' },
    validations: { name: { required: (value) => !!value } },
    reportValidity: false,
    autoSave: { debounce: 1_000, ...autoSave },
  });
  let ctx!: FormContext<Draft, Draft>;

  function Capture() {
    ctx = form.useForm();
    return null;
  }

  const result = render(
    <form.Form original={{ name: 'a' }}>
      <Capture />
      <form.Field name="name" render={(props) => <input {...props} aria-label="name" />} />
      <form.FormState selector={(s) => String(s.saveInProgress)}>
        {(text) => <div data-testid="saving">{text}</div>}
      </form.FormState>
    </form.Form>,
  );

  return { form, ctx: () => ctx, ...result };
}

function change(value: string) {
  act(() => {
    fireEvent.change(screen.getByRole('textbox', { name: 'name' }), { target: { value } });
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('form autosave', () => {
  test('saves the draft once after the debounce, passing the previous draft', async () => {
    const save = vi.fn();
    setup({ save });

    change('b');
    await advance(500);
    change('bc');
    await advance(999);
    expect(save).not.toHaveBeenCalled();

    await advance(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0]).toEqual({ name: 'bc' });
    expect(save.mock.calls[0]![1]).toEqual({ name: 'a' });

    change('bcd');
    await advance(1_000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]![1]).toEqual({ name: 'bc' });
  });

  test('does not save when the draft equals the last saved value', async () => {
    const save = vi.fn();
    setup({ save });

    change('b');
    change('a');
    await advance(1_000);
    expect(save).not.toHaveBeenCalled();
  });

  test('uses a custom equals', async () => {
    const save = vi.fn();
    setup({ save, equals: (a, b) => a.name.toLowerCase() === b.name.toLowerCase() });

    change('A');
    await advance(1_000);
    expect(save).not.toHaveBeenCalled();
  });

  test('skips invalid drafts unless validateBeforeSave is false', async () => {
    const save = vi.fn();
    setup({ save });

    change('');
    await advance(1_000);
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLInputElement>('textbox').validationMessage).toBe('required');
  });

  test('saves invalid drafts with validateBeforeSave: false', async () => {
    const save = vi.fn();
    setup({ save, validateBeforeSave: false });

    change('');
    await advance(1_000);
    expect(save).toHaveBeenCalledWith({ name: '' }, { name: 'a' }, expect.anything());
  });

  test('enabled: false never saves', async () => {
    const save = vi.fn();
    const { ctx } = setup({ save, enabled: false });

    change('b');
    await advance(1_000);
    await act(() => ctx().flushAutosave());
    expect(save).not.toHaveBeenCalled();
  });

  test('flushAutosave saves immediately, cancelAutosave drops the pending save', async () => {
    const save = vi.fn();
    const { ctx } = setup({ save });

    change('b');
    await act(() => ctx().flushAutosave());
    expect(save).toHaveBeenCalledTimes(1);

    change('c');
    await act(() => ctx().cancelAutosave());
    await advance(1_000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  test('flushes a pending save on unmount', async () => {
    const save = vi.fn();
    const { unmount } = setup({ save });

    change('b');
    unmount();
    await advance(0);
    expect(save).toHaveBeenCalledWith({ name: 'b' }, { name: 'a' }, expect.anything());
  });

  test('sets saveInProgress while an async save runs', async () => {
    let resolve!: () => void;
    const save = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    setup({ save });

    change('b');
    await advance(1_000);
    expect(screen.getByTestId('saving').textContent).toBe('true');

    await act(async () => resolve());
    expect(screen.getByTestId('saving').textContent).toBe('false');
  });

  test('resetAfterSave clears the draft after saving', async () => {
    const save = vi.fn();
    const { ctx } = setup({ save, resetAfterSave: true });

    change('b');
    await advance(1_000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(ctx().formState.get().draft).toBeUndefined();
    expect(ctx().hasTriggeredValidations()).toBe(false);
  });

  test('logs save errors and clears saveInProgress', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failure = new Error('boom');
    setup({
      save: () => {
        throw failure;
      },
    });

    change('b');
    await advance(1_000);
    expect(error).toHaveBeenCalledWith('Unhandled error during form autosave:', failure);
    expect(screen.getByTestId('saving').textContent).toBe('false');
    error.mockRestore();
  });

  test('autoSave passed to the Form component is merged with the options', async () => {
    const save = vi.fn();
    const form = createForm<Draft>({
      defaultValue: { name: '' },
      autoSave: { debounce: 1_000 },
    });

    render(
      <form.Form original={{ name: 'a' }} autoSave={{ save }}>
        <form.Field name="name" render={(props) => <input {...props} aria-label="name" />} />
      </form.Form>,
    );

    change('b');
    await advance(1_000);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
