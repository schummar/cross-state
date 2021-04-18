import { Action as BaseAction } from '../action';
import { useAction, UseActionOptions } from './useAction';

export class Action<Arg, Value> extends BaseAction<Arg, Value> {
  useAction(arg: Arg, options: UseActionOptions = {}): [Value | undefined, { error?: unknown; isLoading: boolean }] {
    return useAction(this, arg, options);
  }
}
