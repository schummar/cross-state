import { useEffect, useState } from 'react';
import { ActionInstance, ActionState } from '../action';

export type UseActionOptions = {
  /** Watch value without triggering loading it */
  watchOnly?: boolean;
  /**  */
  updateOnMount?: boolean;
  /** */
  dormant?: boolean;
  /** */
  throttle?: number;
};

export type CombinedActionState<Actions extends readonly ActionInstance<any, any>[]> = Omit<ActionState<any>, 'value'> & {
  values: { [K in keyof Actions]: Actions[K] extends ActionInstance<any, infer Value> ? Value | undefined : never };
};

const ignore = () => {
  //ignore
};

export function useCombinedActions<Actions extends readonly ActionInstance<any, any>[]>(
  ...args: [...actions: Actions] | [...actions: Actions, options?: UseActionOptions]
): CombinedActionState<Actions> {
  const actions = args.filter((x) => x instanceof ActionInstance) as unknown as Actions;
  const options = args.find((x) => !(x instanceof ActionInstance)) as UseActionOptions | undefined;
  const { watchOnly, updateOnMount, dormant, throttle } = options ?? {};

  // This id is updated when the action notifies about changes, in order to trigger another render
  const [, setId] = useState({});

  useEffect(() => {
    if (updateOnMount && !dormant) {
      for (const action of actions) {
        action.invalidateCache();
      }
    }
  }, []);

  useEffect(() => {
    if (dormant) {
      return;
    }

    const handles = actions.map((action) =>
      action.subscribe(
        () => {
          setId({});
          if (!watchOnly) action.get().catch(ignore);
        },
        { throttle }
      )
    );

    return () => {
      for (const handle of handles) {
        handle();
      }
    };
  }, [
    //
    actions.map((action) => action.id).join(','),
    watchOnly,
    dormant,
    throttle,
  ]);

  const state = actions.map((action) => action.getCache());
  return {
    values: state.map((x) => x?.value) as any,
    error: state.find((x) => x?.error !== undefined)?.error,
    isLoading: state.some((x) => x?.isLoading),
    stale: state.some((x) => x?.stale),
  };
}

export function useAction<Arg, Value>(action: ActionInstance<Arg, Value>, options?: UseActionOptions): ActionState<Value> {
  const {
    values: [value],
    ...rest
  } = useCombinedActions(action, options);

  return {
    value,
    ...rest,
  };
}
