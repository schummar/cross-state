import { autobind } from '@lib/autobind';

export class PromiseCancelError extends Error {
  constructor() {
    super('cancelled');
  }
}

export class PromiseWithCancel<T> extends Promise<T> {
  static {
    /* @__PURE__ */ autobind(PromiseWithCancel);
  }

  private abortController;

  constructor(
    executor: (
      resolve: (value: T) => void,
      reject: (error: unknown) => void,
      signal: AbortSignal,
    ) => void,
  ) {
    const abortController = new AbortController();

    super((resolve, reject) => {
      executor(resolve, reject, abortController.signal);

      abortController.signal.addEventListener('abort', (e) => {
        reject(abortController.signal.reason);
      });
    });

    this.abortController = abortController;
  }

  cancel(reason: any = new PromiseCancelError()): void {
    this.abortController.abort(reason);
  }
}
