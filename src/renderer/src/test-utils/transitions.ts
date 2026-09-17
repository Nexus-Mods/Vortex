/**
 * headless-ui's Transition runs its enter over the next few frames, so mounting one leaves state
 * updates queued behind requestAnimationFrame. A test that renders, asserts and returns is done
 * before those land, which drops them between tests where no act() covers them — a warning on a
 * loaded CI box and silence locally, where cleanup unmounts first and cancels them.
 *
 * Call this at the end of such a test, after the assertions: settling completes the enter, so it
 * strips the enter-from classes a test may be checking.
 *
 * Tests that already await something (userEvent, findBy*) don't need it — the await flushes the
 * frames under act() already.
 *
 * Test-only: nothing in the production tree imports this module.
 */
import { act } from "@testing-library/react";

export const settleTransitions = (): Promise<void> =>
  act(async () => {
    // @headlessui/react 2.2.10, dist/hooks/use-transition.js and dist/utils/disposables.js:
    // the enter is started with `nextFrame(run)`, and `nextFrame` is rAF nested in rAF, so
    // `run()` lands on the second frame. It nests one more requestAnimationFrame around the
    // completion check, which puts `done()` on the third. Four leaves a frame of slack.
    for (let i = 0; i < 4; i += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  });
