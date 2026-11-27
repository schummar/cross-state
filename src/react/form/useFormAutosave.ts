import type { FormContext, FormState } from './form';
import type { Duration, Store } from '@core';
import { debounce } from '@lib/debounce';
import { calcDuration } from '@lib/duration';
import { deepEqual } from '@lib/equals';
import type { MaybePromise } from '@lib/maybePromise';
import { queue } from '@lib/queue';
import useLatestFunction from '@react/lib/useLatestFunction';
import { useEffect, useMemo, useRef } from 'react';

export interface FormAutosaveOptions<TDraft, TOriginal> {
  enabled?: boolean;
  validateBeforeSave?: boolean;
  /** `signal` aborts when a newer save replaces this one, see `flushOnHidden`. */
  save?: (
    draft: TDraft,
    prev: TDraft,
    form: FormContext<TDraft, TOriginal>,
    context: { signal: AbortSignal },
  ) => MaybePromise<void>;
  debounce?: Duration;
  /**
   * Save right away when the page gets hidden (reload, closing the tab, switching apps), so
   * pending changes are not lost. A save still in flight is aborted and replaced, since the
   * browser cancels it on unload. Default: true.
   */
  flushOnHidden?: boolean;
  resetAfterSave?: boolean;
  equals?: (a: any, b: any) => boolean;
}

// Field values not yet committed to the draft (commitOnBlur, commitDebounce). Keyed by formState,
// which every per-render context object shares.
const pendingCommits = new WeakMap<Store<FormState<any>>, Set<() => void>>();

export function registerPendingCommit(
  formState: Store<FormState<any>>,
  commit: () => void,
): () => void {
  let commits = pendingCommits.get(formState);
  if (!commits) {
    commits = new Set();
    pendingCommits.set(formState, commits);
  }

  commits.add(commit);
  return () => commits.delete(commit);
}

function commitPendingValues(formState: Store<FormState<any>>) {
  for (const commit of pendingCommits.get(formState) ?? []) {
    commit();
  }
}

function untilAborted(signal: AbortSignal) {
  return new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

export function useFormAutosave<TDraft, TOriginal extends TDraft>(
  form: FormContext<TDraft, TOriginal>,
): {
  flush(): Promise<void>;
  cancel(): Promise<void>;
} {
  const {
    enabled = true,
    validateBeforeSave = true,
    flushOnHidden = true,
  } = form.options.autoSave ?? {};

  const isActive = enabled && !!form.options.autoSave?.save;
  const debounceTime = calcDuration(form.options.autoSave?.debounce ?? 2_000);
  const prev = useRef(form.getDraft());
  const q = useMemo(() => queue(), []);
  const running = useRef<AbortController>(undefined);

  const latestSave = useLatestFunction(async () => {
    if (validateBeforeSave && !form.validate()) {
      return;
    }

    const draft = form.getDraft();
    const equals =
      form.options.autoSave?.equals ?? ((a, b) => deepEqual(a, b, { undefinedEqualsAbsent: true }));

    if (!isActive || equals(draft, prev.current)) {
      return;
    }

    const controller = new AbortController();
    running.current = controller;
    form.formState.set('saveInProgress', true);

    try {
      await Promise.race([
        form.options.autoSave?.save?.(draft, prev.current, form, { signal: controller.signal }),
        untilAborted(controller.signal),
      ]);
      prev.current = draft;

      if (q.size === 0 && form.options.autoSave?.resetAfterSave) {
        form.reset();
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('Unhandled error during form autosave:', error);
      }
    } finally {
      if (running.current === controller) {
        running.current = undefined;
      }

      form.formState.set('saveInProgress', false);
    }
  });

  const scheduleSave = useMemo(
    () =>
      debounce(() => {
        q.clear();
        void q(latestSave);
      }, debounceTime),
    [q, latestSave, debounceTime],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }

    return form.formState
      .map((state) => state.draft)
      .subscribe(
        (draft) => {
          if (draft === undefined) {
            return;
          }

          scheduleSave();
        },
        {
          runNow: false,
        },
      );
  }, [isActive, form.formState, scheduleSave]);

  useEffect(() => {
    if (!isActive || !flushOnHidden) {
      return;
    }

    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') {
        return;
      }

      commitPendingValues(form.formState);
      running.current?.abort();
      scheduleSave.cancel();
      q.clear();
      void q(latestSave);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isActive, flushOnHidden, form.formState, q, latestSave, scheduleSave]);

  useEffect(() => {
    return () => {
      scheduleSave.flush();
    };
  }, [scheduleSave]);

  return {
    flush() {
      commitPendingValues(form.formState);
      scheduleSave.flush();
      return q.whenDone();
    },
    cancel() {
      scheduleSave.cancel();
      return q.whenDone();
    },
  };
}
