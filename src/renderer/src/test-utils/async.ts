/**
 * Drain the queued continuations and microtasks so pending flows settle before a NEGATIVE
 * assertion or a fake-timer step, without betting on a wall-clock delay.
 *
 * TODO: get rid of this once bluebird is out of the picture.
 */
export async function flushAsync(): Promise<void> {
  // enough rounds to run a few chained continuations, each scheduling the next
  const ROUNDS = 5;
  for (let round = 0; round < ROUNDS; round += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}
