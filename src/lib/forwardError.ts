export function forwardError(error: unknown): void {
  setTimeout(() => {
    throw error;
  });
}
