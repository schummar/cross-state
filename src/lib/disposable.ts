import type { Cancel } from '@core';
import type { DisposableCancel } from '@core/commonTypes';

export default function disposable(dispose: Cancel): DisposableCancel {
  return Object.assign(
    dispose,
    Symbol.dispose ? { [Symbol.dispose]: dispose } : {},
  ) as DisposableCancel;
}
