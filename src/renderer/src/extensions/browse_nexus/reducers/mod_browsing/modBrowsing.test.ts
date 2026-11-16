import { describe, expect, it } from "vitest";

import { setHasGivenFeedback } from "../../actions/modBrowsing";
import { modBrowsingReducer } from "./modBrowsing";

describe("modBrowsingReducer", () => {
  it("starts with no feedback given", () => {
    expect(modBrowsingReducer.defaults).toEqual({ hasGivenFeedback: false });
  });

  it("records that feedback was given", () => {
    const state = modBrowsingReducer.reducers[setHasGivenFeedback.getType()](
      { hasGivenFeedback: false },
      true,
    );

    expect(state).toEqual({ hasGivenFeedback: true });
  });
});
