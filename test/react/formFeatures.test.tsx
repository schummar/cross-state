import { createForm, CustomInput, useClosestForm, type FormContext } from '../../src/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vite-plus/test';

function input(label: string) {
  return screen.getByRole<HTMLInputElement>('textbox', { name: label });
}

function change(label: string, value: string) {
  act(() => {
    fireEvent.change(input(label), { target: { value } });
  });
}

function blur(label: string) {
  act(() => {
    fireEvent.blur(input(label));
  });
}

function click(label: string) {
  act(() => {
    screen.getByRole('button', { name: label }).click();
  });
}

function capture<TDraft>(form: { useForm(): FormContext<TDraft, any> }) {
  const ref: { current: FormContext<TDraft, any> | undefined } = { current: undefined };

  function Capture() {
    ref.current = form.useForm();
    return null;
  }

  return { Capture, ctx: () => ref.current! };
}

describe('form context', () => {
  test('useForm outside a Form throws', () => {
    const form = createForm({ defaultValue: { name: '' } });
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    function Component() {
      form.useForm();
      return null;
    }

    expect(() => render(<Component />)).toThrow('Form context not found');
    error.mockRestore();
  });

  test('useClosestForm returns the enclosing form instance', () => {
    const form = createForm({ defaultValue: { name: '' } });
    const seen: unknown[] = [];

    function Component() {
      seen.push(useClosestForm());
      return null;
    }

    render(<Component />);
    expect(seen.at(-1)).toBeNull();

    render(
      <form.Form>
        <Component />
      </form.Form>,
    );
    expect(seen.at(-1)).toBe(form);
  });

  test('withForm wraps a component in the form', () => {
    const form = createForm({ defaultValue: { name: 'x' } });

    const Wrapped = form.withForm(
      ({ label }: { label: string }) => (
        <form.Field name="name" render={(props) => <input {...props} aria-label={label} />} />
      ),
      { original: { name: 'y' } },
    );

    render(<Wrapped label="name" />);
    expect(input('name').value).toBe('y');
  });

  test('Form defaultValue prop is merged over the options defaultValue', () => {
    const form = createForm<{ a?: string; b?: string }>({ defaultValue: { a: 'a', b: 'b' } });
    const { Capture, ctx } = capture(form);

    render(
      <form.Form defaultValue={{ b: 'B' }}>
        <Capture />
      </form.Form>,
    );
    expect(ctx().getDraft()).toEqual({ a: 'a', b: 'B' });
  });

  test('reset drops the draft and the triggered validations', () => {
    const form = createForm({ defaultValue: { name: '' }, reportValidity: false });
    const { Capture, ctx } = capture(form);

    render(
      <form.Form original={{ name: 'a' }}>
        <Capture />
      </form.Form>,
    );

    act(() => {
      ctx().getField('name').setValue('b');
      ctx().validate();
    });
    expect(ctx().hasChanges()).toBe(true);
    expect(ctx().hasTriggeredValidations()).toBe(true);

    act(() => ctx().reset());
    expect(ctx().getDraft()).toEqual({ name: 'a' });
    expect(ctx().hasChanges()).toBe(false);
    expect(ctx().hasTriggeredValidations()).toBe(false);
  });

  test('transform receives the previous value', () => {
    const previous: string[] = [];
    const form = createForm({
      defaultValue: { name: '', changes: 0 },
      transform: (draft, { previousValue }) => {
        if (draft.name !== previousValue.name) {
          previous.push(previousValue.name);
          draft.changes = previousValue.changes + 1;
        }
      },
    });
    const { Capture, ctx } = capture(form);

    render(
      <form.Form original={{ name: 'a', changes: 0 }}>
        <Capture />
      </form.Form>,
    );

    act(() => ctx().getField('name').setValue('b'));
    act(() => ctx().getField('name').setValue('c'));
    expect(previous).toEqual(['a', 'b']);
    expect(ctx().getDraft()).toEqual({ name: 'c', changes: 2 });
  });

  test('onOriginalChange overwrite replaces the draft', () => {
    const form = createForm({ defaultValue: { name: '' } });
    const { Capture, ctx } = capture(form);

    const tree = (name: string) => (
      <form.Form original={{ name }} onOriginalChange="overwrite">
        <Capture />
      </form.Form>
    );

    const { rerender } = render(tree('a'));
    act(() => ctx().getField('name').setValue('edited'));

    rerender(tree('b'));
    expect(ctx().getDraft()).toEqual({ name: 'b' });
  });

  test('without edits the draft follows original changes', () => {
    const form = createForm({ defaultValue: { name: '' } });
    const { Capture, ctx } = capture(form);

    const { rerender } = render(
      <form.Form original={{ name: 'a' }}>
        <Capture />
      </form.Form>,
    );
    rerender(
      <form.Form original={{ name: 'b' }}>
        <Capture />
      </form.Form>,
    );
    expect(ctx().getDraft()).toEqual({ name: 'b' });
    expect(ctx().hasChanges()).toBe(false);
  });
});

describe('validations', () => {
  test('function validations collect errors per field', () => {
    const form = createForm<{ a: string; b: string }>({
      defaultValue: { a: '', b: '' },
      validations: function* ({ draft }) {
        if (!draft.a) {
          yield { name: 'a', error: 'required' };
          yield { name: 'a', error: 'short' };
        }
        if (draft.b === draft.a) {
          yield { name: 'b', error: 'same' };
        }
      },
    });
    const { Capture, ctx } = capture(form);

    render(
      <form.Form>
        <Capture />
      </form.Form>,
    );
    expect([...ctx().getErrors()]).toEqual([
      ['a', ['required', 'short']],
      ['b', ['same']],
    ]);
    expect(ctx().isValid()).toBe(false);
  });

  test('localizeError maps error keys, keeping unknown ones', () => {
    const form = createForm<{ a: string; b: string }>({
      defaultValue: { a: '', b: '' },
      validations: {
        a: { required: (v) => !!v },
        b: { other: (v) => !!v },
      },
      localizeError: (error, field) => (error === 'required' ? `${field} is required` : undefined),
    });
    const { Capture, ctx } = capture(form);

    render(
      <form.Form>
        <Capture />
      </form.Form>,
    );
    expect(ctx().getField('a').errors).toEqual(['a is required']);
    expect(ctx().getField('b').errors).toEqual(['other']);
  });

  test('validations receive draft, original and the concrete field name', () => {
    const calls: unknown[] = [];
    const form = createForm<{ items: string[] }>({
      defaultValue: { items: [] },
      validations: {
        'items.*': {
          check: (value, { original, field }) => {
            calls.push([value, original?.items.length, field]);
            return true;
          },
        },
      },
    });

    render(<form.Form original={{ items: ['x', 'y'] }} />);
    expect(calls).toEqual([
      ['x', 2, 'items.0'],
      ['y', 2, 'items.1'],
    ]);
  });

  test('includeNestedErrors collects errors below the field', () => {
    const form = createForm<{ address: { city: string; zip: string } }>({
      defaultValue: { address: { city: '', zip: '' } },
      validations: {
        'address.city': { required: (v) => !!v },
        'address.zip': { required: (v) => !!v },
      },
    });
    const { Capture, ctx } = capture(form);

    render(
      <form.Form>
        <Capture />
      </form.Form>,
    );
    expect(ctx().getField('address').errors).toEqual([]);
    expect(ctx().getField('address', { includeNestedErrors: true }).errors).toEqual([
      'required',
      'required',
    ]);
  });

  test('initiallyTriggerValidations marks the form validated from the start', () => {
    const form = createForm({
      defaultValue: { name: '' },
      validations: { name: { required: (v) => !!v } },
    });

    const { container } = render(<form.Form initiallyTriggerValidations />);
    const element = container.querySelector('form')!;
    expect(element.className).toBe('validated');
    expect(element.dataset.valid).toBe('false');
  });

  test('validate with scrollTo focuses the first invalid element', () => {
    const form = createForm({
      defaultValue: { a: 'ok', b: '' },
      validations: { b: { required: (v) => !!v } },
    });
    const { Capture, ctx } = capture(form);
    const scrollIntoView = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined);

    render(
      <form.Form>
        <Capture />
        <form.Field name="a" render={(props) => <input {...props} aria-label="a" />} />
        <form.Field name="b" render={(props) => <input {...props} aria-label="b" />} />
      </form.Form>,
    );

    let valid: boolean | undefined;
    act(() => {
      valid = ctx().validate({ reportValidity: 'scrollTo' });
    });
    expect(valid).toBe(false);
    expect(document.activeElement).toBe(input('b'));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    scrollIntoView.mockRestore();
  });

  test('validate with browser reporting calls reportValidity on the form', () => {
    const form = createForm({ defaultValue: { name: '' } });
    const { Capture, ctx } = capture(form);

    const { container } = render(
      <form.Form>
        <Capture />
      </form.Form>,
    );
    const reportValidity = vi.spyOn(container.querySelector('form')!, 'reportValidity');

    act(() => void ctx().validate());
    expect(reportValidity).toHaveBeenCalled();
  });
});

describe('submit', () => {
  const setup = (onSubmit: (...args: any[]) => unknown, validatedClass?: string) => {
    const form = createForm({
      defaultValue: { name: '' },
      validations: { name: { required: (v) => !!v } },
      reportValidity: false,
    });

    const { container } = render(
      <form.Form onSubmit={onSubmit} validatedClass={validatedClass} className="custom">
        <form.Field name="name" render={(props) => <input {...props} aria-label="name" />} />
        <form.FormState selector={(s) => String(s.saveInProgress)}>
          {(text) => <div data-testid="saving">{text}</div>}
        </form.FormState>
        <button type="submit">submit</button>
      </form.Form>,
    );

    return container.querySelector('form')!;
  };

  test('invalid submit marks the form validated and skips onSubmit', async () => {
    const onSubmit = vi.fn();
    const element = setup(onSubmit);
    expect(element.className).toBe('custom');
    expect(element.dataset.validated).toBeUndefined();

    await act(async () => click('submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(element.className).toBe('custom validated');
    expect(element.dataset.validated).toBe('true');
    expect(element.dataset.valid).toBe('false');
    expect(screen.getByRole<HTMLButtonElement>('button').validationMessage).toBe('required');

    change('name', 'x');
    expect(element.dataset.valid).toBe('true');
  });

  test('valid submit calls onSubmit with the derived state', async () => {
    const onSubmit = vi.fn();
    setup(onSubmit, 'was-validated');
    change('name', 'x');

    await act(async () => click('submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![1]).toMatchObject({
      draft: { name: 'x' },
      hasChanges: true,
      isValid: true,
      saveInProgress: true,
    });
    expect(document.querySelector('form')!.className).toBe('custom was-validated');
  });

  test('an async onSubmit keeps saveInProgress set and blocks resubmits', async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    setup(onSubmit);
    change('name', 'x');

    await act(async () => click('submit'));
    expect(screen.getByTestId('saving').textContent).toBe('true');

    await act(async () => click('submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await act(async () => resolve());
    expect(screen.getByTestId('saving').textContent).toBe('false');
  });
});

describe('Field', () => {
  test('exposes value, originalValue and hasChange', () => {
    const form = createForm({ defaultValue: { name: '' } });
    const { Capture, ctx } = capture(form);

    render(
      <form.Form original={{ name: 'a' }}>
        <Capture />
      </form.Form>,
    );

    const field = () => ctx().getField('name');
    expect(field()).toMatchObject({ value: 'a', originalValue: 'a', hasChange: false });

    act(() => field().setValue((value) => value + 'b'));
    expect(field()).toMatchObject({ value: 'ab', originalValue: 'a', hasChange: true });
  });

  test('originalValue is undefined without an original', () => {
    const form = createForm({ defaultValue: { name: 'd' } });
    const { Capture, ctx } = capture(form);

    render(
      <form.Form>
        <Capture />
      </form.Form>,
    );
    expect(ctx().getField('name').originalValue).toBeUndefined();
    expect(ctx().getField('name').value).toBe('d');
  });

  test('record helpers: names, add, remove', () => {
    const form = createForm<{ map: Record<string, number> }>({ defaultValue: { map: { a: 1 } } });
    const { Capture, ctx } = capture(form);

    render(
      <form.Form>
        <Capture />
      </form.Form>,
    );

    act(() => ctx().getField('map').add('b', 2));
    expect(ctx().getField('map').names).toEqual(['map.a', 'map.b']);

    act(() => ctx().getField('map').remove('a'));
    expect(ctx().getDraft()).toEqual({ map: { b: 2 } });
  });

  test('add and remove throw on missing values', () => {
    const form = createForm<{ list?: string[] }>({ defaultValue: {} });
    const { Capture, ctx } = capture(form);

    render(
      <form.Form>
        <Capture />
      </form.Form>,
    );
    // The helper methods are only typed for non-optional values.
    const field = ctx().getField('list') as any;
    expect(() => field.add('x')).toThrow('Cannot add element to undefined');
    expect(() => field.remove(0)).toThrow('Cannot remove element from undefined');
    expect(field.names).toEqual([]);
  });

  test('children works like render and receives field infos', () => {
    const form = createForm({ defaultValue: { name: '' } });

    render(
      <form.Form original={{ name: 'a' }}>
        <form.Field name="name">
          {(props, info) => (
            <>
              <input {...props} aria-label="name" />
              <span data-testid="info">{`${info.hasChange}:${info.hasTriggeredValidations}`}</span>
            </>
          )}
        </form.Field>
      </form.Form>,
    );

    expect(screen.getByTestId('info').textContent).toBe('false:false');
    change('name', 'b');
    expect(screen.getByTestId('info').textContent).toBe('true:false');
  });

  test('onChange accepts plain values as well as events', () => {
    const form = createForm({ defaultValue: { count: 0 } });
    const { Capture, ctx } = capture(form);

    render(
      <form.Form>
        <Capture />
        <form.Field
          name="count"
          render={(props) => <button onClick={() => props.onChange(props.value + 1)}>inc</button>}
        />
      </form.Form>,
    );

    click('inc');
    click('inc');
    expect(ctx().getDraft()).toEqual({ count: 2 });
  });

  test('sets data-invalid when the field has errors', () => {
    const form = createForm({
      defaultValue: { name: '' },
      validations: { name: { required: (v) => !!v } },
    });

    render(
      <form.Form>
        <form.Field name="name" render={(props) => <input {...props} aria-label="name" />} />
      </form.Form>,
    );

    expect(input('name').dataset.invalid).toBe('true');
    change('name', 'x');
    expect(input('name').dataset.invalid).toBeUndefined();
  });

  test('commitOnBlur keeps the value local until blur', () => {
    const form = createForm({ defaultValue: { name: '' } });
    const { Capture, ctx } = capture(form);

    render(
      <form.Form>
        <Capture />
        <form.Field
          name="name"
          commitOnBlur
          render={(props) => <input {...props} aria-label="name" />}
        />
      </form.Form>,
    );

    change('name', 'x');
    expect(input('name').value).toBe('x');
    expect(ctx().getDraft()).toEqual({ name: '' });

    blur('name');
    expect(ctx().getDraft()).toEqual({ name: 'x' });
  });

  describe('commitDebounce', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    test('commits after the debounce, or earlier on blur', () => {
      vi.useFakeTimers();
      const form = createForm({ defaultValue: { name: '' } });
      const { Capture, ctx } = capture(form);

      render(
        <form.Form>
          <Capture />
          <form.Field
            name="name"
            commitDebounce={500}
            render={(props) => <input {...props} aria-label="name" />}
          />
        </form.Form>,
      );

      change('name', 'x');
      change('name', 'xy');
      act(() => void vi.advanceTimersByTime(499));
      expect(ctx().getDraft()).toEqual({ name: '' });

      act(() => void vi.advanceTimersByTime(1));
      expect(ctx().getDraft()).toEqual({ name: 'xy' });

      change('name', 'xyz');
      blur('name');
      expect(ctx().getDraft()).toEqual({ name: 'xyz' });
    });
  });

  test('transformFieldProps can rewrite the props', () => {
    const form = createForm({
      defaultValue: { name: 'a' },
      validations: { name: { min: (v) => v.length > 1 } },
      transformFieldProps: (props, info) =>
        ({
          ...props,
          'aria-label': props.name,
          'aria-description': info.errors.join(','),
        }) as typeof props,
    });

    render(
      <form.Form>
        <form.Field name="name" render={(props) => <input {...props} />} />
        <form.Field name="name" component="input" />
      </form.Form>,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox', { name: 'name' });
    expect(inputs).toHaveLength(2);
    expect(inputs.map((i) => i.getAttribute('aria-description'))).toEqual(['min', 'min']);
  });

  test('useFieldProps returns the props for a custom input', () => {
    const form = createForm({ defaultValue: { name: 'a' } });

    function Input() {
      const props = form.useFieldProps('name');
      return <input {...props} aria-label="name" />;
    }

    render(
      <form.Form>
        <Input />
      </form.Form>,
    );

    expect(input('name').name).toBe('name');
    change('name', 'b');
    expect(input('name').value).toBe('b');
  });
});

describe('legacy Field (component)', () => {
  test('inputFilter rejects values, and onChange/onBlur are passed through', () => {
    const form = createForm({ defaultValue: { digits: '' } });
    const { Capture, ctx } = capture(form);
    const onChange = vi.fn();
    const onBlur = vi.fn();

    render(
      <form.Form>
        <Capture />
        <form.Field
          name="digits"
          component="input"
          aria-label="digits"
          inputFilter={(value) => /^\d*$/.test(value as string)}
          onChange={onChange}
          onBlur={onBlur}
        />
      </form.Form>,
    );

    change('digits', '12');
    change('digits', '12a');
    expect(ctx().getDraft()).toEqual({ digits: '12' });
    expect(onChange).toHaveBeenCalledTimes(1);

    blur('digits');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  test('serialize, deserialize and defaultValue', () => {
    const form = createForm<{ count: number; note?: string }>({ defaultValue: { count: 1 } });
    const { Capture, ctx } = capture(form);

    render(
      <form.Form>
        <Capture />
        <form.Field
          name="count"
          component="input"
          aria-label="count"
          serialize={(value) => String(value)}
          deserialize={(value) => Number(value)}
        />
        <form.Field name="note" component="input" aria-label="note" defaultValue="none" />
      </form.Form>,
    );

    expect(input('count').value).toBe('1');
    expect(input('note').value).toBe('none');

    change('count', '42');
    expect(ctx().getDraft()).toEqual({ count: 42 });
  });

  test('commitOnBlur keeps the value local until blur', () => {
    const form = createForm({ defaultValue: { name: '' } });
    const { Capture, ctx } = capture(form);

    render(
      <form.Form>
        <Capture />
        <form.Field name="name" component="input" aria-label="name" commitOnBlur />
      </form.Form>,
    );

    change('name', 'x');
    expect(input('name').value).toBe('x');
    expect(ctx().getDraft()).toEqual({ name: '' });

    blur('name');
    expect(ctx().getDraft()).toEqual({ name: 'x' });
  });

  describe('commitDebounce', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    test('commits after the debounce', () => {
      vi.useFakeTimers();
      const form = createForm({ defaultValue: { name: '' } });
      const { Capture, ctx } = capture(form);

      render(
        <form.Form>
          <Capture />
          <form.Field name="name" component="input" aria-label="name" commitDebounce={500} />
        </form.Form>,
      );

      change('name', 'x');
      act(() => void vi.advanceTimersByTime(499));
      expect(ctx().getDraft()).toEqual({ name: '' });

      act(() => void vi.advanceTimersByTime(1));
      expect(ctx().getDraft()).toEqual({ name: 'x' });
    });
  });
});

describe('ForEach', () => {
  test('filter hides elements but keeps their keys', () => {
    const form = createForm({ defaultValue: { arr: [1, 2, 3, 4] } });

    render(
      <form.Form>
        <form.ForEach
          name="arr"
          filter={(item) => item % 2 === 0}
          renderElement={({ name, index, count }) => <div>{`${name} ${index}/${count}`}</div>}
        />
      </form.Form>,
    );

    expect(screen.getByText('arr.1 0/2')).toBeDefined();
    expect(screen.getByText('arr.3 1/2')).toBeDefined();
    expect(screen.queryByText(/arr\.0/)).toBeNull();
  });

  test('renderAdditionalElement renders one extra slot that fills the array', () => {
    const form = createForm({ defaultValue: { arr: ['a'] } });
    const { Capture, ctx } = capture(form);

    render(
      <form.Form>
        <Capture />
        <form.ForEach
          name="arr"
          renderAdditionalElement
          renderElement={({ name }) => (
            <form.Field name={name} render={(props) => <input {...props} aria-label={name} />} />
          )}
        />
      </form.Form>,
    );

    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    change('arr.1', 'b');
    expect(ctx().getDraft()).toEqual({ arr: ['a', 'b'] });
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
  });

  test('iterates records and exposes add, remove and setValue to children', () => {
    const form = createForm<{ map: Record<string, number> }>({ defaultValue: { map: { a: 1 } } });
    const { Capture, ctx } = capture(form);

    render(
      <form.Form>
        <Capture />
        <form.ForEach name="map" renderElement={({ key }) => <div>{`key ${key}`}</div>}>
          {({ names, add, remove, setValue }) => (
            <>
              <span data-testid="names">{names.join(',')}</span>
              <button onClick={() => add('b', 2)}>add</button>
              <button onClick={() => remove('a')}>remove</button>
              <button onClick={() => setValue({ z: 26 })}>set</button>
            </>
          )}
        </form.ForEach>
      </form.Form>,
    );

    expect(screen.getByText('key a')).toBeDefined();

    click('add');
    expect(screen.getByTestId('names').textContent).toBe('map.a,map.b');

    click('remove');
    expect(ctx().getDraft()).toEqual({ map: { b: 2 } });

    click('set');
    expect(screen.getByTestId('names').textContent).toBe('map.z');
  });

  test('renders nothing for a missing value', () => {
    const form = createForm<{ arr?: number[] }>({ defaultValue: {} });

    const { container } = render(
      <form.Form>
        <form.ForEach name="arr" renderElement={({ name }) => <div>{name}</div>} />
      </form.Form>,
    );
    expect(container.querySelector('form')!.childNodes).toHaveLength(0);
  });
});

describe('CustomInput', () => {
  test('renders a hidden named input that carries the field validity', () => {
    const form = createForm({
      defaultValue: { color: '' },
      validations: { color: { required: (v) => !!v } },
      reportValidity: false,
    });

    const { container } = render(
      <form.Form initiallyTriggerValidations>
        <CustomInput name="color" data-testid="wrapper" style={{ color: 'red' }}>
          <span>picker</span>
        </CustomInput>
      </form.Form>,
    );

    const wrapper = screen.getByTestId('wrapper');
    expect(wrapper.style.position).toBe('relative');
    expect(wrapper.style.color).toBe('red');
    expect(screen.getByText('picker')).toBeDefined();

    const hidden = container.querySelector<HTMLInputElement>('input[name="color"]')!;
    expect(hidden.validationMessage).toBe('required');
  });
});
