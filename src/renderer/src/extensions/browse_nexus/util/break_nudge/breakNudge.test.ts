import { describe, expect, it } from "vitest";

import { isBreakNudgePause } from "./breakNudge";

describe("isBreakNudgePause", () => {
  it.each([
    [540, false],
    [600, true],
    [660, false],
    [1200, true],
    [1260, false],
    [1800, true],
  ])("nudges at each multiple that's on a pause, and only there: %i is %s", (loaded, isNudge) => {
    expect(isBreakNudgePause({ loaded, every: 600, perPause: 60 })).toBe(isNudge);
  });

  it.each([
    [600, false],
    [660, true],
    [720, false],
    [1200, false],
    [1260, true],
  ])(
    "nudges once at the first pause past each multiple between pauses: %i is %s",
    (loaded, isNudge) => {
      expect(isBreakNudgePause({ loaded, every: 601, perPause: 60 })).toBe(isNudge);
    },
  );

  it.each([
    [600, true],
    [700, false],
    [1200, true],
  ])("nudges at each multiple when the pauses come further apart: %i is %s", (loaded, isNudge) => {
    expect(isBreakNudgePause({ loaded, every: 600, perPause: 100 })).toBe(isNudge);
  });

  it("doesn't nudge before the first pause", () => {
    expect(isBreakNudgePause({ loaded: 0, every: 600, perPause: 60 })).toBe(false);
  });
});
