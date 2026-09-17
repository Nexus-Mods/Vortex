/**
 * headless-ui's Transition runs its enter over the next few frames, so mounting one leaves state
 * updates queued behind requestAnimationFrame. A test that renders, asserts and returns is done
 * before those land, which drops them between tests where no act() covers them — a warning on a
 * loaded CI box and silence locally, where cleanup unmounts first and cancels them.
 *
 * Waits for every transition on the page to finish, under act(). `data-transition` is headless-ui's
 * own marker for an element mid-transition — the one it gives you to style against — and it is gone
 * once the enter completes.
 *
 * Call this at the end of such a test, after the assertions: settling completes the enter, so it
 * strips the enter-from classes a test may be checking.
 *
 * Tests that already await something (userEvent, findBy*) don't need it — the await flushes the
 * frames under act() already.
 *
 * Test-only: nothing in the production tree imports this module.
 */
import { waitFor } from "@testing-library/react";
import { expect } from "vitest";

export const settleTransitions = (): Promise<void> =>
  waitFor(() => {
    expect(document.querySelector("[data-transition]")).toBeNull();
  });
