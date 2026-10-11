/** Run every cleanup even if stopping one subsystem fails. */
export function cleanupAll(steps: Array<() => void>, onError: (error: unknown) => void): void {
  for (const step of steps) {
    try { step(); } catch (error) { onError(error); }
  }
}
