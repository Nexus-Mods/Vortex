// active suppressions, keyed by test event type
const suppressedTests: Record<string, number> = {};
// the latest run a suppression skipped, keyed by test event type
const skippedRuns: Record<string, () => void> = {};

/**
 * Whether checks for the event are suppressed. A run skipped while suppressed is replayed once the
 * last suppression lifts.
 */
export function skipWhileSuppressed(event: string, run: () => void): boolean {
  if ((suppressedTests[event] ?? 0) === 0) {
    return false;
  }
  skippedRuns[event] = run;
  return true;
}

export function withSuppressedTests(tests: string[], cb: () => PromiseLike<void>) {
  tests.forEach((test) => {
    suppressedTests[test] = (suppressedTests[test] ?? 0) + 1;
  });

  return Promise.resolve(cb()).finally(() => {
    tests.forEach((test) => {
      suppressedTests[test] -= 1;
      const skipped = skippedRuns[test];
      if (suppressedTests[test] === 0 && skipped !== undefined) {
        delete skippedRuns[test];
        skipped();
      }
    });
  });
}
