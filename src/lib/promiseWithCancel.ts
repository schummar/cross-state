export class PromiseWithCancel<T> extends Promise<T> {
  private abortController = new AbortController();

  constructor(
    executor: (
      resolve: (value: T) => void,
      reject: (error: unknown) => void,
      signal: AbortSignal,
    ) => void,
  ) {
    super((resolve, reject) => {
      executor(resolve, reject, this.abortController.signal);
    });
  }

  cancel() {
    this.abortController.abort();
  }
}
