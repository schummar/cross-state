import { ActionInstance as BaseActionInstance } from '../action';
import { useAction, UseActionOptions, UseActionReturn } from './useAction';

export class ActionInstance<Arg, Value> extends BaseActionInstance<Arg, Value> {
  useAction(options?: UseActionOptions): UseActionReturn<Value> {
    return useAction(this, options);
  }
}
