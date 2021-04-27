import { Action as BaseAction } from '../action';
import { useAction, UseActionOptions, UseActionReturn } from './useAction';

export class Action<Arg, Value> extends BaseAction<Arg, Value> {
  useAction(arg: Arg, options?: UseActionOptions): UseActionReturn<Value> {
    return useAction(this, arg, options);
  }
}
