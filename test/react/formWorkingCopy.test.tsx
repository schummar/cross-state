import { createForm, type FormContext, type WorkingCopy } from '../../src/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { describe, expect, test } from 'vite-plus/test';

type Draft = { name: string; items: { title: string }[] };

function setup() {
  const form = createForm<Draft>({
    defaultValue: { name: '', items: [] },
    validations: {
      'items.*.title': {
        required: (value) => !!value,
      },
    },
    reportValidity: false,
  });

  return form;
}

function input(label: string) {
  return screen.getByRole<HTMLInputElement>('textbox', { name: label });
}

function change(label: string, value: string) {
  act(() => {
    fireEvent.change(input(label), { target: { value } });
  });
}

function click(label: string) {
  act(() => {
    screen.getByRole('button', { name: label }).click();
  });
}

describe('WorkingCopy', () => {
  test('edits stay in the copy until apply; discard drops them', () => {
    const form = setup();

    render(
      <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
        <form.Field
          name="items.0.title"
          render={(props) => <input {...props} aria-label="outer" />}
        />

        <form.WorkingCopy>
          {({ apply, discard }) => (
            <>
              <form.Field
                name="items.0.title"
                render={(props) => <input {...props} aria-label="inner" />}
              />
              <button onClick={apply}>apply</button>
              <button onClick={discard}>discard</button>
            </>
          )}
        </form.WorkingCopy>
      </form.Form>,
    );

    change('inner', 'b');
    expect(input('inner').value).toBe('b');
    expect(input('outer').value).toBe('a');

    click('apply');
    expect(input('inner').value).toBe('b');
    expect(input('outer').value).toBe('b');

    change('inner', 'c');
    expect(input('outer').value).toBe('b');

    click('discard');
    expect(input('inner').value).toBe('b');
    expect(input('outer').value).toBe('b');
  });

  test('the copy is frozen at mount: parent changes do not reach it', () => {
    const form = setup();

    render(
      <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
        <form.Field
          name="items.0.title"
          render={(props) => <input {...props} aria-label="outer" />}
        />
        <form.WorkingCopy>
          <form.Field
            name="items.0.title"
            render={(props) => <input {...props} aria-label="inner" />}
          />
        </form.WorkingCopy>
      </form.Form>,
    );

    change('outer', 'b');
    expect(input('inner').value).toBe('a');
  });

  test('unmounting the copy discards its draft', () => {
    const form = setup();

    function Component() {
      const [show, setShow] = useState(true);

      return (
        <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
          <button onClick={() => setShow((s) => !s)}>toggle</button>
          {show && (
            <form.WorkingCopy>
              <form.Field
                name="items.0.title"
                render={(props) => <input {...props} aria-label="inner" />}
              />
            </form.WorkingCopy>
          )}
        </form.Form>
      );
    }

    render(<Component />);

    change('inner', 'b');
    click('toggle');
    click('toggle');
    expect(input('inner').value).toBe('a');
  });

  test('validate() inside the copy reports the copy errors without touching the parent', () => {
    const form = setup();
    let inner: FormContext<Draft, Draft> | undefined;
    let outer: FormContext<Draft, Draft> | undefined;

    function Capture({ into }: { into: (ctx: FormContext<Draft, Draft>) => void }) {
      into(form.useForm());
      return null;
    }

    render(
      <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
        <Capture into={(ctx) => (outer = ctx)} />
        <form.WorkingCopy>
          <Capture into={(ctx) => (inner = ctx)} />
          <form.Field
            name="items.0.title"
            render={(props, { errors }) => (
              <>
                <input {...props} aria-label="inner" />
                <div data-testid="inner-errors">{errors.join(',')}</div>
              </>
            )}
          />
          <form.FormState selector={(state) => state.hasTriggeredValidations}>
            {(triggered) => <div data-testid="inner-triggered">{String(triggered)}</div>}
          </form.FormState>
        </form.WorkingCopy>
      </form.Form>,
    );

    change('inner', '');
    expect(screen.getByTestId('inner-errors').textContent).toBe('required');

    let valid: boolean | undefined;
    act(() => {
      valid = inner!.validate();
    });

    expect(valid).toBe(false);
    expect(screen.getByTestId('inner-triggered').textContent).toBe('true');
    expect(outer!.hasTriggeredValidations()).toBe(false);
    expect(outer!.getDraft().items[0]!.title).toBe('a');
    expect(outer!.isValid()).toBe(true);
  });

  test('parent changes made while the copy is dirty survive apply', () => {
    const form = setup();
    let inner: FormContext<Draft, Draft> | undefined;

    function Capture() {
      inner = form.useForm();
      return null;
    }

    render(
      <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
        <form.Field name="name" render={(props) => <input {...props} aria-label="name" />} />
        <form.Field
          name="items.0.title"
          render={(props) => <input {...props} aria-label="outer" />}
        />
        <form.WorkingCopy>
          {({ apply }) => (
            <>
              <Capture />
              <form.Field
                name="items.0.title"
                render={(props) => <input {...props} aria-label="inner" />}
              />
              <button onClick={apply}>apply</button>
            </>
          )}
        </form.WorkingCopy>
      </form.Form>,
    );

    change('inner', 'b');
    change('name', 'changed');

    expect(inner!.getDraft()).toEqual({ name: 'root', items: [{ title: 'b' }] });

    click('apply');
    expect(input('name').value).toBe('changed');
    expect(input('outer').value).toBe('b');
  });

  test('hasChanges inside the copy means dirty relative to the parent draft; originalValue is the real original', () => {
    const form = setup();

    render(
      <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
        <form.Field
          name="items.0.title"
          render={(props) => <input {...props} aria-label="outer" />}
        />
        <form.WorkingCopy>
          {({ apply }) => (
            <>
              <form.Field
                name="items.0.title"
                render={(props, { hasChange, originalValue }) => (
                  <>
                    <input {...props} aria-label="inner" />
                    <div data-testid="field">{`${hasChange}:${originalValue}`}</div>
                  </>
                )}
              />
              <form.FormState selector={(state) => state.hasChanges}>
                {(hasChanges) => <div data-testid="form">{String(hasChanges)}</div>}
              </form.FormState>
              <button onClick={apply}>apply</button>
            </>
          )}
        </form.WorkingCopy>
      </form.Form>,
    );

    change('outer', 'x');
    expect(screen.getByTestId('form').textContent).toBe('false');
    expect(screen.getByTestId('field').textContent).toBe('false:a');

    change('inner', 'y');
    expect(screen.getByTestId('form').textContent).toBe('true');
    expect(screen.getByTestId('field').textContent).toBe('true:a');

    click('apply');
    expect(screen.getByTestId('form').textContent).toBe('false');
    expect(screen.getByTestId('field').textContent).toBe('true:a');
  });

  test('nested copies apply one level up', () => {
    const form = setup();

    render(
      <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
        <form.Field
          name="items.0.title"
          render={(props) => <input {...props} aria-label="root" />}
        />
        <form.WorkingCopy>
          {({ apply }) => (
            <>
              <form.Field
                name="items.0.title"
                render={(props) => <input {...props} aria-label="middle" />}
              />
              <button onClick={apply}>apply middle</button>
              <form.WorkingCopy>
                {({ apply }) => (
                  <>
                    <form.Field
                      name="items.0.title"
                      render={(props) => <input {...props} aria-label="inner" />}
                    />
                    <button onClick={apply}>apply inner</button>
                  </>
                )}
              </form.WorkingCopy>
            </>
          )}
        </form.WorkingCopy>
      </form.Form>,
    );

    change('inner', 'b');
    expect(input('middle').value).toBe('a');
    expect(input('root').value).toBe('a');

    click('apply inner');
    expect(input('middle').value).toBe('b');
    expect(input('root').value).toBe('a');

    click('apply middle');
    expect(input('root').value).toBe('b');
  });

  test('ForEach inside a copy', () => {
    const form = setup();

    render(
      <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
        <form.ForEach name="items">
          {({ names }) => <div data-testid="outer">{names.length}</div>}
        </form.ForEach>
        <form.WorkingCopy>
          {({ apply }) => (
            <>
              <form.ForEach name="items">
                {({ names, add }) => (
                  <>
                    <div data-testid="inner">{names.length}</div>
                    <button onClick={() => add({ title: 'b' })}>add</button>
                  </>
                )}
              </form.ForEach>
              <button onClick={apply}>apply</button>
            </>
          )}
        </form.WorkingCopy>
      </form.Form>,
    );

    click('add');
    expect(screen.getByTestId('inner').textContent).toBe('2');
    expect(screen.getByTestId('outer').textContent).toBe('1');

    click('apply');
    expect(screen.getByTestId('outer').textContent).toBe('2');
  });

  test('useWorkingCopy from a nested component; throws outside a copy', () => {
    const form = setup();

    function Buttons() {
      const { apply } = form.useWorkingCopy();
      return <button onClick={apply}>apply</button>;
    }

    function Outside() {
      let error: unknown;
      try {
        form.useWorkingCopy();
      } catch (e) {
        error = e;
      }
      return <div data-testid="error">{String(error)}</div>;
    }

    render(
      <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
        <Outside />
        <form.Field
          name="items.0.title"
          render={(props) => <input {...props} aria-label="outer" />}
        />
        <form.WorkingCopy>
          <form.Field
            name="items.0.title"
            render={(props) => <input {...props} aria-label="inner" />}
          />
          <Buttons />
        </form.WorkingCopy>
      </form.Form>,
    );

    expect(screen.getByTestId('error').textContent).toContain('useWorkingCopy');

    change('inner', 'b');
    click('apply');
    expect(input('outer').value).toBe('b');
  });

  test('ref exposes the handle outside the copy', () => {
    const form = setup();

    function Component() {
      const ref = useRef<WorkingCopy<Draft, Draft>>(null);

      return (
        <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
          <form.Field
            name="items.0.title"
            render={(props) => <input {...props} aria-label="outer" />}
          />
          <form.WorkingCopy ref={ref}>
            <form.Field
              name="items.0.title"
              render={(props) => <input {...props} aria-label="inner" />}
            />
          </form.WorkingCopy>
          <button onClick={() => ref.current!.apply()}>apply</button>
          <button onClick={() => ref.current!.discard()}>discard</button>
        </form.Form>
      );
    }

    render(<Component />);

    change('inner', 'b');
    click('discard');
    expect(input('inner').value).toBe('a');

    change('inner', 'c');
    click('apply');
    expect(input('outer').value).toBe('c');
  });
});

describe('WorkingCopy review cases', () => {
  test('apply only writes the copy edits; a parent change in the same tick survives', () => {
    const form = setup();
    let outer: FormContext<Draft, Draft> | undefined;

    function Capture() {
      outer = form.useForm();
      return null;
    }

    render(
      <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
        <Capture />
        <form.Field name="name" render={(props) => <input {...props} aria-label="name" />} />
        <form.Field
          name="items.0.title"
          render={(props) => <input {...props} aria-label="outer" />}
        />
        <form.WorkingCopy>
          {({ apply }) => (
            <>
              <form.Field
                name="items.0.title"
                render={(props) => <input {...props} aria-label="inner" />}
              />
              <button
                onClick={() => {
                  outer!.getField('name').setValue('x');
                  apply();
                }}
              >
                apply
              </button>
            </>
          )}
        </form.WorkingCopy>
      </form.Form>,
    );

    change('inner', 'b');
    click('apply');

    expect(outer!.getDraft()).toEqual({ name: 'x', items: [{ title: 'b' }] });
  });

  test('apply on an untouched copy leaves the parent alone', () => {
    const form = setup();
    let outer: FormContext<Draft, Draft> | undefined;

    function Capture() {
      outer = form.useForm();
      return null;
    }

    render(
      <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
        <Capture />
        <form.WorkingCopy>{({ apply }) => <button onClick={apply}>apply</button>}</form.WorkingCopy>
      </form.Form>,
    );

    click('apply');
    expect(outer!.formState.get().draft).toBeUndefined();
    expect(outer!.hasChanges()).toBe(false);
  });

  test('original inside the copy is the real original, validations included', () => {
    const form = createForm<Draft>({
      defaultValue: { name: '', items: [] },
      validations: {
        name: {
          unchanged: (value, { original }) => value === original?.name,
        },
      },
      reportValidity: false,
    });
    let inner: FormContext<Draft, Draft> | undefined;

    function Capture() {
      inner = form.useForm();
      return null;
    }

    render(
      <form.Form original={{ name: 'server', items: [] }}>
        <form.Field name="name" render={(props) => <input {...props} aria-label="name" />} />
        <form.WorkingCopy>
          <Capture />
        </form.WorkingCopy>
      </form.Form>,
    );

    act(() => inner!.getField('name').setValue('edited'));
    expect(inner!.getErrors().get('name')).toEqual(['unchanged']);
    expect(inner!.original).toEqual({ name: 'server', items: [] });
    expect(inner!.getDraft()).toEqual({ name: 'edited', items: [] });
    expect(inner!.hasChanges()).toBe(true);
    expect(input('name').value).toBe('server');
  });

  test('copy inherits hasTriggeredValidations; discard resets it', () => {
    const form = setup();
    let outer: FormContext<Draft, Draft> | undefined;

    function Capture() {
      outer = form.useForm();
      return null;
    }

    function Component() {
      const [show, setShow] = useState(false);

      return (
        <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
          <Capture />
          <button onClick={() => setShow(true)}>open</button>
          {show && (
            <form.WorkingCopy>
              {({ discard }) => (
                <>
                  <form.FormState selector={(state) => state.hasTriggeredValidations}>
                    {(triggered) => <div data-testid="triggered">{String(triggered)}</div>}
                  </form.FormState>
                  <button onClick={discard}>discard</button>
                </>
              )}
            </form.WorkingCopy>
          )}
        </form.Form>
      );
    }

    render(<Component />);

    act(() => {
      outer!.validate();
    });
    click('open');
    expect(screen.getByTestId('triggered').textContent).toBe('true');

    click('discard');
    expect(screen.getByTestId('triggered').textContent).toBe('false');
  });

  test('copy errors do not leak onto parent inputs; validate() writes them, discard restores', () => {
    const form = setup();
    let inner: FormContext<Draft, Draft> | undefined;

    function Capture() {
      inner = form.useForm();
      return null;
    }

    render(
      <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
        <form.Field
          name="items.0.title"
          render={(props) => <input {...props} aria-label="outer" />}
        />
        <form.WorkingCopy>
          {({ discard }) => (
            <>
              <Capture />
              <form.Field
                name="items.0.title"
                render={(props) => <input {...props} aria-label="inner" />}
              />
              <button onClick={discard}>discard</button>
            </>
          )}
        </form.WorkingCopy>
      </form.Form>,
    );

    change('inner', '');
    expect(input('outer').validationMessage).toBe('');

    act(() => {
      inner!.validate();
    });
    expect(input('outer').validationMessage).toBe('required');

    click('discard');
    expect(input('outer').validationMessage).toBe('');
  });

  test('flushAutosave inside a copy flushes the parent autosave', async () => {
    const saved: Draft[] = [];
    const form = createForm<Draft>({
      defaultValue: { name: '', items: [] },
      autoSave: { save: (draft) => void saved.push(draft), debounce: 10_000 },
      reportValidity: false,
    });
    let inner: FormContext<Draft, Draft> | undefined;

    function Capture() {
      inner = form.useForm();
      return null;
    }

    render(
      <form.Form original={{ name: 'root', items: [] }}>
        <form.Field name="name" render={(props) => <input {...props} aria-label="name" />} />
        <form.WorkingCopy>
          <Capture />
        </form.WorkingCopy>
      </form.Form>,
    );

    change('name', 'x');
    await act(() => inner!.flushAutosave());
    expect(saved).toEqual([{ name: 'x', items: [] }]);
  });

  test('transform runs inside the copy', () => {
    const form = createForm<Draft>({
      defaultValue: { name: '', items: [] },
      transform: (draft) => {
        draft.name = draft.name.toUpperCase();
      },
      reportValidity: false,
    });

    render(
      <form.Form original={{ name: 'root', items: [] }}>
        <form.Field name="name" render={(props) => <input {...props} aria-label="outer" />} />
        <form.WorkingCopy>
          {({ apply }) => (
            <>
              <form.Field name="name" render={(props) => <input {...props} aria-label="inner" />} />
              <button onClick={apply}>apply</button>
            </>
          )}
        </form.WorkingCopy>
      </form.Form>,
    );

    expect(input('outer').value).toBe('ROOT');

    change('inner', 'abc');
    expect(input('inner').value).toBe('ABC');
    expect(input('outer').value).toBe('ROOT');

    click('apply');
    expect(input('outer').value).toBe('ABC');
  });
});

describe('WorkingCopy edge cases', () => {
  function CaptureInto({ into }: { into: (ctx: FormContext<Draft, Draft>) => void }) {
    into(useCtx());
    return null;
  }

  let useCtx: () => FormContext<Draft, Draft>;

  function renderWithCopy(
    form: ReturnType<typeof setup>,
    original: Draft,
    copyProps: { onApply?: (workingDraft: Draft, parentDraft: Draft) => Draft | void } = {},
  ) {
    useCtx = () => form.useForm();
    let outer!: FormContext<Draft, Draft>;
    let inner!: FormContext<Draft, Draft>;

    const result = render(
      <form.Form original={original}>
        <CaptureInto into={(ctx) => (outer = ctx)} />
        <form.WorkingCopy {...copyProps}>
          {({ apply, discard }) => (
            <>
              <CaptureInto into={(ctx) => (inner = ctx)} />
              <button onClick={apply}>apply</button>
              <button onClick={discard}>discard</button>
            </>
          )}
        </form.WorkingCopy>
      </form.Form>,
    );

    return {
      ...result,
      get outer() {
        return outer;
      },
      get inner() {
        return inner;
      },
    };
  }

  test('parent appends an item while the copy edits another: both survive apply', () => {
    const form = setup();
    const { outer, inner } = renderWithCopy(form, { name: 'root', items: [{ title: 'a' }] });

    act(() => inner.getField('items.0.title').setValue('b'));
    act(() => outer.getField('items').add({ title: 'n' }));

    expect(inner.getDraft().items).toEqual([{ title: 'b' }]);

    click('apply');
    expect(outer.getDraft().items).toEqual([{ title: 'b' }, { title: 'n' }]);
  });

  test('parent removes a later item while the copy edits an earlier one', () => {
    const form = setup();
    const { outer, inner } = renderWithCopy(form, {
      name: 'root',
      items: [{ title: 'a' }, { title: 'z' }],
    });

    act(() => inner.getField('items.0.title').setValue('b'));
    act(() => outer.getField('items').remove(1));

    click('apply');
    expect(outer.getDraft().items).toEqual([{ title: 'b' }]);
  });

  test('patches are index based: removing an earlier sibling shifts the edit (documented)', () => {
    const form = setup();
    const { outer, inner } = renderWithCopy(form, {
      name: 'root',
      items: [{ title: 'a' }, { title: 'z' }],
    });

    act(() => inner.getField('items.0.title').setValue('b'));
    act(() => outer.getField('items').remove(0));

    click('apply');
    expect(outer.getDraft().items).toEqual([{ title: 'b' }]);
  });

  test('onApply replaces the default patching', () => {
    const form = setup();
    const { outer, inner } = renderWithCopy(
      form,
      { name: 'root', items: [{ title: 'a' }] },
      {
        onApply: (workingDraft, parentDraft) => ({
          ...parentDraft,
          items: workingDraft.items,
        }),
      },
    );

    act(() => inner.getField('name').setValue('ignored'));
    act(() => inner.getField('items.0.title').setValue('b'));
    act(() => outer.getField('name').setValue('outer'));

    click('apply');
    expect(outer.getDraft()).toEqual({ name: 'outer', items: [{ title: 'b' }] });
    expect(inner.hasChanges()).toBe(false);
    expect(inner.getDraft()).toEqual({ name: 'outer', items: [{ title: 'b' }] });
  });

  test('onApply can mutate the parent draft in place', () => {
    const form = setup();
    const { outer, inner } = renderWithCopy(
      form,
      { name: 'root', items: [{ title: 'a' }] },
      {
        onApply: (workingDraft, parentDraft) => {
          parentDraft.items = workingDraft.items;
        },
      },
    );

    act(() => inner.getField('name').setValue('ignored'));
    act(() => inner.getField('items.0.title').setValue('b'));

    click('apply');
    expect(outer.getDraft()).toEqual({ name: 'root', items: [{ title: 'b' }] });
  });

  test('onApply receives the copy context and runs even without patches', () => {
    const form = setup();
    let seen: unknown[] = [];
    const { outer, inner } = renderWithCopy(
      form,
      { name: 'root', items: [] },
      {
        onApply: (...args) => {
          seen = args;
          return { name: 'forced', items: [] };
        },
      },
    );

    act(() => inner.getField('name').setValue('x'));
    act(() => inner.getField('name').setValue('root'));
    click('apply');

    expect(seen[2]).toBe(inner);
    expect(outer.getDraft().name).toBe('forced');
  });

  test('removing an item and a key inside the copy applies as removals', () => {
    type D = { name: string; items: { title: string }[]; meta?: { x?: number } };
    const form = createForm<D>({ defaultValue: { name: '', items: [] }, reportValidity: false });
    let outer!: FormContext<D, D>;
    let inner!: FormContext<D, D>;

    function Capture({ into }: { into: (ctx: FormContext<D, D>) => void }) {
      into(form.useForm());
      return null;
    }

    render(
      <form.Form
        original={{ name: 'root', items: [{ title: 'a' }, { title: 'z' }], meta: { x: 1 } }}
      >
        <Capture into={(ctx) => (outer = ctx)} />
        <form.WorkingCopy>
          {({ apply }) => (
            <>
              <Capture into={(ctx) => (inner = ctx)} />
              <button onClick={apply}>apply</button>
            </>
          )}
        </form.WorkingCopy>
      </form.Form>,
    );

    act(() => inner.getField('items').remove(0));
    act(() => inner.getField('meta.x').removeValue());

    expect(outer.getDraft()).toEqual({
      name: 'root',
      items: [{ title: 'a' }, { title: 'z' }],
      meta: { x: 1 },
    });

    click('apply');
    expect(outer.getDraft()).toEqual({ name: 'root', items: [{ title: 'z' }], meta: {} });
  });

  test('two apply cycles diff against the updated base', () => {
    const form = setup();
    const { outer, inner } = renderWithCopy(form, { name: 'root', items: [{ title: 'a' }] });

    act(() => inner.getField('items.0.title').setValue('b'));
    click('apply');
    expect(outer.getDraft().items[0]!.title).toBe('b');

    act(() => outer.getField('name').setValue('n'));
    act(() => inner.getField('items.0.title').setValue('c'));
    click('apply');

    expect(outer.getDraft()).toEqual({ name: 'n', items: [{ title: 'c' }] });
    expect(inner.hasChanges()).toBe(false);
  });

  test('parent reset() while the copy is dirty: copy keeps its edit, rest reverts', () => {
    const form = setup();
    const { outer, inner } = renderWithCopy(form, { name: 'root', items: [{ title: 'a' }] });

    act(() => outer.getField('name').setValue('n'));
    act(() => inner.getField('items.0.title').setValue('b'));
    act(() => outer.reset());

    expect(inner.getDraft()).toEqual({ name: 'root', items: [{ title: 'b' }] });
    expect(inner.hasChanges()).toBe(true);

    click('apply');
    expect(outer.getDraft()).toEqual({ name: 'root', items: [{ title: 'b' }] });
  });

  test('root original prop change reaches the copy as original, but the frozen draft stays', () => {
    const form = setup();
    useCtx = () => form.useForm();
    let inner!: FormContext<Draft, Draft>;

    const tree = (original: Draft) => (
      <form.Form original={original}>
        <form.WorkingCopy>
          <CaptureInto into={(ctx) => (inner = ctx)} />
        </form.WorkingCopy>
      </form.Form>
    );

    const { rerender } = render(tree({ name: 'a', items: [{ title: 'x' }] }));
    expect(inner.getDraft().name).toBe('a');

    rerender(tree({ name: 'b', items: [{ title: 'x' }] }));
    expect(inner.original?.name).toBe('b');
    expect(inner.getDraft().name).toBe('a');

    act(() => inner.getField('items.0.title').setValue('y'));
    rerender(tree({ name: 'c', items: [{ title: 'x' }] }));
    expect(inner.original?.name).toBe('c');
    expect(inner.getDraft()).toEqual({ name: 'a', items: [{ title: 'y' }] });
  });

  test('originalValue inside a dirty copy stays the real original after a parent change', () => {
    const form = setup();
    const { outer, inner } = renderWithCopy(form, { name: 'root', items: [{ title: 'a' }] });

    act(() => inner.getField('items.0.title').setValue('b'));
    act(() => outer.getField('name').setValue('n'));

    expect(inner.getField('name').originalValue).toBe('root');
    expect(inner.getField('items.0.title').originalValue).toBe('a');
    expect(inner.hasChanges()).toBe(true);
    expect(inner.getDraft()).toEqual({ name: 'root', items: [{ title: 'b' }] });
  });

  test('nested copies with an untouched middle', () => {
    const form = setup();
    let root!: FormContext<Draft, Draft>;
    let middle!: FormContext<Draft, Draft>;
    let inner!: FormContext<Draft, Draft>;
    useCtx = () => form.useForm();

    render(
      <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
        <CaptureInto into={(ctx) => (root = ctx)} />
        <form.WorkingCopy>
          {({ apply }) => (
            <>
              <CaptureInto into={(ctx) => (middle = ctx)} />
              <button onClick={apply}>apply middle</button>
              <form.WorkingCopy>
                {({ apply }) => (
                  <>
                    <CaptureInto into={(ctx) => (inner = ctx)} />
                    <button onClick={apply}>apply inner</button>
                  </>
                )}
              </form.WorkingCopy>
            </>
          )}
        </form.WorkingCopy>
      </form.Form>,
    );

    act(() => inner.getField('items.0.title').setValue('b'));
    act(() => root.getField('name').setValue('n'));
    expect(middle.getDraft().name).toBe('root');
    expect(inner.getDraft()).toEqual({ name: 'root', items: [{ title: 'b' }] });

    click('apply inner');
    expect(middle.getDraft().items[0]!.title).toBe('b');
    expect(middle.hasChanges()).toBe(true);
    expect(root.getDraft().items[0]!.title).toBe('a');
    expect(inner.parent).toBe(middle);
    expect(middle.parent).toBe(root);

    click('apply middle');
    expect(root.getDraft()).toEqual({ name: 'n', items: [{ title: 'b' }] });
  });

  test('copy rendered through a portal', () => {
    const form = setup();

    function Portal({ children }: { children: React.ReactNode }) {
      return createPortal(children, document.body);
    }

    render(
      <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
        <form.Field
          name="items.0.title"
          render={(props) => <input {...props} aria-label="outer" />}
        />
        <Portal>
          <form.WorkingCopy>
            {({ apply }) => (
              <>
                <form.Field
                  name="items.0.title"
                  render={(props) => <input {...props} aria-label="inner" />}
                />
                <button onClick={apply}>apply</button>
              </>
            )}
          </form.WorkingCopy>
        </Portal>
      </form.Form>,
    );

    expect(input('inner').closest('form')).toBeNull();

    change('inner', 'b');
    expect(input('outer').value).toBe('a');

    click('apply');
    expect(input('outer').value).toBe('b');
  });

  test('unmounting a validated copy restores the parent validity', () => {
    const form = setup();
    let inner!: FormContext<Draft, Draft>;
    useCtx = () => form.useForm();

    function Component() {
      const [show, setShow] = useState(true);

      return (
        <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
          <form.Field
            name="items.0.title"
            render={(props) => <input {...props} aria-label="outer" />}
          />
          <button onClick={() => setShow(false)}>close</button>
          {show && (
            <form.WorkingCopy>
              <CaptureInto into={(ctx) => (inner = ctx)} />
            </form.WorkingCopy>
          )}
        </form.Form>
      );
    }

    render(<Component />);

    act(() => inner.getField('items.0.title').setValue(''));
    act(() => {
      inner.validate();
    });
    expect(input('outer').validationMessage).toBe('required');

    click('close');
    expect(input('outer').validationMessage).toBe('');
  });

  test('useField and useFieldProps inside a copy', () => {
    const form = setup();

    function Inner() {
      const field = form.useField('items.0.title');
      const props = form.useFieldProps('items.0.title');
      return (
        <>
          <input {...props} aria-label="inner" />
          <div data-testid="value">{field.value}</div>
        </>
      );
    }

    render(
      <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
        <form.Field
          name="items.0.title"
          render={(props) => <input {...props} aria-label="outer" />}
        />
        <form.WorkingCopy>
          <Inner />
        </form.WorkingCopy>
      </form.Form>,
    );

    change('inner', 'b');
    expect(screen.getByTestId('value').textContent).toBe('b');
    expect(input('outer').value).toBe('a');
  });

  test('works under StrictMode', () => {
    const form = setup();

    render(
      <StrictMode>
        <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
          <form.Field
            name="items.0.title"
            render={(props) => <input {...props} aria-label="outer" />}
          />
          <form.WorkingCopy>
            {({ apply, discard }) => (
              <>
                <form.Field
                  name="items.0.title"
                  render={(props) => <input {...props} aria-label="inner" />}
                />
                <button onClick={apply}>apply</button>
                <button onClick={discard}>discard</button>
              </>
            )}
          </form.WorkingCopy>
        </form.Form>
      </StrictMode>,
    );

    change('inner', 'b');
    expect(input('outer').value).toBe('a');
    click('discard');
    expect(input('inner').value).toBe('a');
    change('inner', 'c');
    click('apply');
    expect(input('outer').value).toBe('c');
  });
});

describe('WorkingCopy handle', () => {
  test('the handle carries the copy context; a hook in the render function sees the parent', () => {
    const form = setup();
    let fromHook!: FormContext<Draft, Draft>;
    let fromHandle!: FormContext<Draft, Draft>;
    let outer!: FormContext<Draft, Draft>;

    function Capture() {
      outer = form.useForm();
      return null;
    }

    render(
      <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
        <Capture />
        <form.WorkingCopy>
          {({ form: copy }) => {
            fromHook = form.useForm();
            fromHandle = copy;
            return (
              <form.Field
                name="items.0.title"
                render={(props) => <input {...props} aria-label="inner" />}
              />
            );
          }}
        </form.WorkingCopy>
      </form.Form>,
    );

    expect(fromHook).toBe(outer);
    expect(fromHandle).not.toBe(outer);
    expect(fromHandle.parent).toBe(outer);

    change('inner', '');
    expect(fromHandle.validate()).toBe(false);
    expect(outer.hasTriggeredValidations()).toBe(false);
    expect(fromHandle.getDraft().items[0]!.title).toBe('');
    expect(outer.getDraft().items[0]!.title).toBe('a');
  });

  test('useWorkingCopy() returns the same handle shape', () => {
    const form = setup();
    let handle!: ReturnType<typeof form.useWorkingCopy>;

    function Inner() {
      handle = form.useWorkingCopy();
      return null;
    }

    render(
      <form.Form original={{ name: 'root', items: [] }}>
        <form.WorkingCopy>
          <Inner />
        </form.WorkingCopy>
      </form.Form>,
    );

    expect(typeof handle.apply).toBe('function');
    expect(typeof handle.discard).toBe('function');
    expect(handle.form.parent).toBeDefined();
    expect(handle.form.workingCopy).toBe(handle);
  });
});

describe('WorkingCopy frozen base', () => {
  test('apply re-snapshots the base; discard keeps it', () => {
    const form = setup();
    let outer!: FormContext<Draft, Draft>;
    let inner!: FormContext<Draft, Draft>;

    function Cap({ into }: { into: (ctx: FormContext<Draft, Draft>) => void }) {
      into(form.useForm());
      return null;
    }

    render(
      <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
        <Cap into={(ctx) => (outer = ctx)} />
        <form.WorkingCopy>
          {({ apply, discard }) => (
            <>
              <Cap into={(ctx) => (inner = ctx)} />
              <button onClick={apply}>apply</button>
              <button onClick={discard}>discard</button>
            </>
          )}
        </form.WorkingCopy>
      </form.Form>,
    );

    act(() => outer.getField('name').setValue('n'));
    act(() => inner.getField('items.0.title').setValue('b'));
    click('discard');
    expect(inner.getDraft()).toEqual({ name: 'root', items: [{ title: 'a' }] });

    act(() => inner.getField('items.0.title').setValue('c'));
    click('apply');
    expect(outer.getDraft()).toEqual({ name: 'n', items: [{ title: 'c' }] });
    expect(inner.getDraft()).toEqual({ name: 'n', items: [{ title: 'c' }] });
    expect(inner.hasChanges()).toBe(false);
  });

  test('the copy component does not re-render on parent keystrokes', () => {
    const form = setup();
    let copyRenders = 0;

    function Count() {
      copyRenders++;
      return null;
    }

    render(
      <form.Form original={{ name: 'root', items: [] }}>
        <form.Field name="name" render={(props) => <input {...props} aria-label="outer" />} />
        <form.WorkingCopy>
          <Count />
        </form.WorkingCopy>
      </form.Form>,
    );

    const before = copyRenders;
    change('outer', 'x');
    change('outer', 'xy');
    expect(copyRenders).toBe(before);
  });
});

describe('WorkingCopy original passthrough', () => {
  test('server-only properties of the original are reachable inside the copy', () => {
    type D = { name: string };
    type O = D & { id: string; updatedAt: number };
    const form = createForm<D, O>({ defaultValue: { name: '' } });
    let inner!: FormContext<D, O>;

    function Capture() {
      inner = form.useForm();
      return null;
    }

    render(
      <form.Form original={{ name: 'a', id: '42', updatedAt: 1 }}>
        <form.Field name="name" render={(props) => <input {...props} aria-label="name" />} />
        <form.WorkingCopy>
          <Capture />
          <form.Field
            name="name"
            render={(_props, { originalValue }, form) => (
              <div data-testid="meta">{`${form.original?.id}:${originalValue}`}</div>
            )}
          />
        </form.WorkingCopy>
      </form.Form>,
    );

    act(() => inner.getField('name').setValue('b'));
    expect(screen.getByTestId('meta').textContent).toBe('42:a');
    expect(inner.original?.updatedAt).toBe(1);
    expect(inner.getDraft()).toMatchObject({ name: 'b' });
    expect(input('name').value).toBe('a');
  });

  test('a form without original: copy reads through to defaultValue', () => {
    const form = setup();
    let inner!: FormContext<Draft, Draft>;

    function Capture() {
      inner = form.useForm();
      return null;
    }

    render(
      <form.Form>
        <form.Field name="name" render={(props) => <input {...props} aria-label="outer" />} />
        <form.WorkingCopy>
          {({ apply }) => (
            <>
              <Capture />
              <form.Field name="name" render={(props) => <input {...props} aria-label="inner" />} />
              <button onClick={apply}>apply</button>
            </>
          )}
        </form.WorkingCopy>
      </form.Form>,
    );

    expect(inner.getDraft()).toEqual({ name: '', items: [] });
    expect(inner.original).toBeUndefined();

    change('inner', 'x');
    expect(input('outer').value).toBe('');
    click('apply');
    expect(input('outer').value).toBe('x');
  });
});

describe('WorkingCopy review round 2', () => {
  function Capture({ into }: { into: (ctx: FormContext<Draft, Draft>) => void }) {
    into(setupForm.useForm());
    return null;
  }
  let setupForm: ReturnType<typeof setup>;

  function renderPair(original: Draft) {
    setupForm = setup();
    let outer!: FormContext<Draft, Draft>;
    let inner!: FormContext<Draft, Draft>;

    const result = render(
      <setupForm.Form original={original}>
        <Capture into={(ctx) => (outer = ctx)} />
        <setupForm.Field
          name="items.0.title"
          render={(props) => <input {...props} aria-label="outer" />}
        />
        <setupForm.WorkingCopy>
          {({ apply }) => (
            <>
              <Capture into={(ctx) => (inner = ctx)} />
              <setupForm.Field
                name="items.0.title"
                render={(props) => <input {...props} aria-label="inner" />}
              />
              <button onClick={apply}>apply</button>
            </>
          )}
        </setupForm.WorkingCopy>
      </setupForm.Form>,
    );

    return {
      ...result,
      get outer() {
        return outer;
      },
      get inner() {
        return inner;
      },
    };
  }

  test('removing several items in the copy applies correctly', () => {
    const { outer, inner } = renderPair({
      name: 'root',
      items: [{ title: 'a' }, { title: 'b' }, { title: 'c' }],
    });

    act(() => inner.getField('items').remove(2));
    act(() => inner.getField('items').remove(1));
    click('apply');
    expect(outer.getDraft().items).toEqual([{ title: 'a' }]);
  });

  test('removing the first item twice in the copy applies correctly', () => {
    const { outer, inner } = renderPair({
      name: 'root',
      items: [{ title: 'a' }, { title: 'b' }, { title: 'c' }],
    });

    act(() => inner.getField('items').remove(0));
    act(() => inner.getField('items').remove(0));
    click('apply');
    expect(outer.getDraft().items).toEqual([{ title: 'c' }]);
  });

  test('parent removes several items while the copy is dirty elsewhere', () => {
    const { outer, inner } = renderPair({
      name: 'root',
      items: [{ title: 'a' }, { title: 'b' }, { title: 'c' }],
    });

    act(() => inner.getField('name').setValue('x'));
    act(() => outer.getField('items').setValue([{ title: 'a' }]));
    expect(inner.getDraft().items).toHaveLength(3);

    click('apply');
    expect(outer.getDraft()).toEqual({ name: 'x', items: [{ title: 'a' }] });
  });

  test('a no-op apply does not materialise the parent draft', () => {
    const form = setup();
    let outer!: FormContext<Draft, Draft>;
    let inner!: FormContext<Draft, Draft>;

    function Cap({ into }: { into: (ctx: FormContext<Draft, Draft>) => void }) {
      into(form.useForm());
      return null;
    }

    const tree = (original: Draft) => (
      <form.Form original={original}>
        <Cap into={(ctx) => (outer = ctx)} />
        <form.WorkingCopy>
          {({ apply }) => (
            <>
              <Cap into={(ctx) => (inner = ctx)} />
              <button onClick={apply}>apply</button>
            </>
          )}
        </form.WorkingCopy>
      </form.Form>
    );

    const { rerender } = render(tree({ name: 'a', items: [] }));

    act(() => inner.getField('name').setValue('b'));
    act(() => inner.getField('name').setValue('a'));
    click('apply');
    expect(outer.formState.get().draft).toBeUndefined();

    rerender(tree({ name: 'server', items: [] }));
    expect(outer.getDraft().name).toBe('server');
  });

  test('a root re-render keeps the validity a validated copy wrote', () => {
    const form = setup();
    let inner!: FormContext<Draft, Draft>;

    function Cap() {
      inner = form.useForm();
      return null;
    }

    function Component() {
      const [, tick] = useState(0);
      return (
        <>
          <button onClick={() => tick((n) => n + 1)}>tick</button>
          <form.Form original={{ name: 'root', items: [{ title: 'a' }] }}>
            <form.WorkingCopy>
              <Cap />
              <form.Field
                name="items.0.title"
                render={(props) => <input {...props} aria-label="inner" />}
              />
            </form.WorkingCopy>
          </form.Form>
        </>
      );
    }

    render(<Component />);
    change('inner', '');
    act(() => {
      inner.validate();
    });
    expect(input('inner').validationMessage).toBe('required');

    click('tick');
    expect(input('inner').validationMessage).toBe('required');

    change('inner', 'fixed');
    expect(input('inner').validationMessage).toBe('');
  });

  test('the copy takes hasTriggeredValidations at mount only', () => {
    const form = setup();
    let outer!: FormContext<Draft, Draft>;

    function Cap() {
      outer = form.useForm();
      return null;
    }

    render(
      <form.Form original={{ name: 'root', items: [] }}>
        <Cap />
        <form.WorkingCopy>
          <form.FormState selector={(s) => s.hasTriggeredValidations}>
            {(t) => <div data-testid="triggered">{String(t)}</div>}
          </form.FormState>
        </form.WorkingCopy>
      </form.Form>,
    );

    expect(screen.getByTestId('triggered').textContent).toBe('false');
    act(() => {
      outer.validate();
    });
    expect(screen.getByTestId('triggered').textContent).toBe('false');
  });
});
