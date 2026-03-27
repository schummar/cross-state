import { render, act } from '@testing-library/react';
import React from 'react';
import { describe, expect, test, vi } from 'vitest';
import {
  onOriginalChangeDefault,
  onOriginalChangeMerge,
  onOriginalChangeOverwrite,
  resolveOnOriginalChange,
} from './formOnOriginalChange';
import { Form, type FormContext } from './form';

const mockForm = {} as FormContext<any, any>;

describe('onOriginalChangeDefault', () => {
  test('returns draft unchanged', () => {
    const draft = { name: 'Alice', age: 30 };
    const result = onOriginalChangeDefault(undefined, undefined, draft, mockForm);
    expect(result).toBe(draft);
  });

  test('returns draft when original changes', () => {
    const draft = { name: 'Alice' };
    const result = onOriginalChangeDefault({ name: 'Bob' }, { name: 'Charlie' }, draft, mockForm);
    expect(result).toBe(draft);
  });
});

describe('onOriginalChangeOverwrite', () => {
  test('returns newOriginal as draft', () => {
    const newOriginal = { name: 'Bob', age: 25 };
    const result = onOriginalChangeOverwrite(
      { name: 'Alice', age: 30 },
      newOriginal,
      { name: 'Alice', age: 30 },
      mockForm,
    );
    expect(result).toBe(newOriginal);
  });

  test('returns undefined when newOriginal is undefined', () => {
    const result = onOriginalChangeOverwrite(
      { name: 'Alice' },
      undefined,
      { name: 'Alice' },
      mockForm,
    );
    expect(result).toBeUndefined();
  });
});

describe('onOriginalChangeMerge', () => {
  test('applies changes from original to draft when draft matches old value', () => {
    const oldOriginal = { name: 'Alice', age: 30 };
    const newOriginal = { name: 'Alice', age: 31 };
    const draft = { name: 'Alice', age: 30 };

    const result = onOriginalChangeMerge(oldOriginal, newOriginal, draft, mockForm);
    expect(result).toEqual({ name: 'Alice', age: 31 });
  });

  test('does not overwrite draft changes that differ from old original', () => {
    const oldOriginal = { name: 'Alice', age: 30 };
    const newOriginal = { name: 'Alice', age: 31 };
    const draft = { name: 'Alice', age: 99 }; // user modified age

    const result = onOriginalChangeMerge(oldOriginal, newOriginal, draft, mockForm);
    expect(result).toEqual({ name: 'Alice', age: 99 });
  });

  test('merges only the changed fields', () => {
    const oldOriginal = { name: 'Alice', role: 'user' };
    const newOriginal = { name: 'Bob', role: 'user' };
    const draft = { name: 'Alice', role: 'admin' }; // user modified role

    const result = onOriginalChangeMerge(oldOriginal, newOriginal, draft, mockForm);
    expect(result).toEqual({ name: 'Bob', role: 'admin' });
  });

  test('handles removed fields by setting them to undefined', () => {
    const oldOriginal = { name: 'Alice', note: 'hello' };
    const newOriginal = { name: 'Alice' };
    const draft = { name: 'Alice', note: 'hello' };

    const result = onOriginalChangeMerge(oldOriginal, newOriginal, draft, mockForm);
    expect((result as any).note).toBeUndefined();
  });

  test('does not remove field that was modified in draft', () => {
    const oldOriginal = { name: 'Alice', note: 'hello' };
    const newOriginal = { name: 'Alice' };
    const draft = { name: 'Alice', note: 'changed by user' };

    const result = onOriginalChangeMerge(oldOriginal, newOriginal, draft, mockForm);
    expect((result as any).note).toBe('changed by user');
  });

  test('handles undefined oldOriginal', () => {
    const newOriginal = { name: 'Alice' };
    const draft = {};

    const result = onOriginalChangeMerge(undefined, newOriginal, draft, mockForm);
    expect(result).toBeDefined();
  });

  test('handles nested fields', () => {
    const oldOriginal = { address: { city: 'NYC', zip: '10001' } };
    const newOriginal = { address: { city: 'LA', zip: '10001' } };
    const draft = { address: { city: 'NYC', zip: '10001' } };

    const result = onOriginalChangeMerge(oldOriginal, newOriginal, draft, mockForm);
    expect(result).toEqual({ address: { city: 'LA', zip: '10001' } });
  });
});

describe('resolveOnOriginalChange', () => {
  test('returns onOriginalChangeDefault for undefined', () => {
    const handler = resolveOnOriginalChange(undefined);
    const draft = { name: 'Alice' };
    expect(handler(undefined, undefined, draft, mockForm)).toBe(draft);
  });

  test('resolves "default" builtin', () => {
    const handler = resolveOnOriginalChange('default');
    const draft = { name: 'Alice' };
    expect(handler(undefined, undefined, draft, mockForm)).toBe(draft);
  });

  test('resolves "merge" builtin', () => {
    const handler = resolveOnOriginalChange('merge');
    const oldOriginal = { name: 'Alice' };
    const newOriginal = { name: 'Bob' };
    const draft = { name: 'Alice' };
    expect(handler(oldOriginal, newOriginal, draft, mockForm)).toEqual({ name: 'Bob' });
  });

  test('resolves "overwrite" builtin', () => {
    const handler = resolveOnOriginalChange('overwrite');
    const newOriginal = { name: 'Bob' };
    const result = handler({ name: 'Alice' }, newOriginal, { name: 'Alice' }, mockForm);
    expect(result).toBe(newOriginal);
  });

  test('returns custom function as-is', () => {
    const custom = vi.fn((old: any, next: any, draft: any) => ({ ...draft, merged: true }));
    const handler = resolveOnOriginalChange(custom);
    expect(handler).toBe(custom);
  });

  test('returns onOriginalChangeDefault for unknown string', () => {
    const handler = resolveOnOriginalChange('unknown' as any);
    const draft = { x: 1 };
    expect(handler(undefined, undefined, draft, mockForm)).toBe(draft);
  });
});

describe('integration: onOriginalChange in a Form', () => {
  type Profile = { name: string; age: number };

  const form = new Form<Profile, Profile>({
    defaultValue: { name: '', age: 0 },
    onOriginalChange: 'merge',
  });

  test('merges original updates into draft, preserving user edits', async () => {
    let capturedCtx: FormContext<Profile, Profile> | null = null;

    function Inspector() {
      capturedCtx = form.useForm();
      return null;
    }

    const { rerender } = render(
      <form.Form original={{ name: 'Alice', age: 30 }}>
        <Inspector />
      </form.Form>,
    );

    // Simulate the user editing age — this makes the draft non-undefined
    act(() => {
      capturedCtx!.getField('age').setValue(99);
    });

    expect(capturedCtx!.getDraft()).toEqual({ name: 'Alice', age: 99 });

    // Original changes: name updated, age unchanged
    await act(async () => {
      rerender(
        <form.Form original={{ name: 'Bob', age: 30 }}>
          <Inspector />
        </form.Form>,
      );
    });

    // name should be merged from original (user hadn't changed it)
    // age should stay 99 (user changed it, so merge skips it)
    expect(capturedCtx!.getDraft()).toEqual({ name: 'Bob', age: 99 });
  });
});
