import { autobind } from '@lib/autobind';

export class PromiseCancelError extends Error {
  constructor() {
    super('cancelled');
  }
}

export class PromiseWithCancel<T> extends Promise<T> {
  private abortController;

  constructor(
    executor: (
      resolve: (value: T) => void,
      reject: (error: unknown) => void,
      signal: AbortSignal,
    ) => void,
  ) {
    autobind(PromiseWithCancel);
    const abortController = new AbortController();

    super((resolve, reject) => {
      executor(resolve, reject, abortController.signal);

      abortController.signal.addEventListener('abort', (e) => {
        reject(abortController.signal.reason);
      });
    });

    this.abortController = abortController;
  }

  cancel(reason: any = new PromiseCancelError()) {
    this.abortController.abort(reason);
  }
}
