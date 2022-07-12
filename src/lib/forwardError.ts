export function forwardError(error: unknown) {
  setTimeout(() => {
    throw error;
  });
}
