import { describe, it, expect } from "vitest";

import settingsReducer from "./reducers";

describe("dismissStep", () => {
  it('dismisses a todo message from the "first steps" list', () => {
    const input = { dismissAll: false, steps: { stepId0: true } };
    const result = settingsReducer.reducers.DISMISS_STEP(input, "stepId1");
    expect(result).toEqual({ dismissAll: false, steps: { stepId0: true, stepId1: true } });
    expect(input).toEqual({ dismissAll: false, steps: { stepId0: true } });
  });
});
