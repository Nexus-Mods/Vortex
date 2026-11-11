import { describe, expect, it } from "vitest";

import { isBreakNudgePause } from "./breakNudge";

describe("isBreakNudgePause", () => {
  it.each([
    [540, false],
    [600, true],
    [660, false],
  ])("nudges at a threshold on a pause, and only there: %i loaded is %s", (loaded, isNudge) => {
    expect(isBreakNudgePause({ loaded, threshold: 600, perPause: 60 })).toBe(isNudge);
  });

  it.each([
    [600, false],
    [660, true],
    [720, false],
  ])(
    "nudges once at the first pause past a threshold between pauses: %i is %s",
    (loaded, isNudge) => {
      expect(isBreakNudgePause({ loaded, threshold: 601, perPause: 60 })).toBe(isNudge);
    },
  );

  it("nudges at the threshold when the pauses come further apart", () => {
    expect(isBreakNudgePause({ loaded: 600, threshold: 600, perPause: 100 })).toBe(true);
    expect(isBreakNudgePause({ loaded: 700, threshold: 600, perPause: 100 })).toBe(false);
  });
});
