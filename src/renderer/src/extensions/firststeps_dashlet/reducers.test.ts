import { describe, it, expect } from "vitest";

import settingsReducer from "./reducers";

describe("dismissStep", () => {
  it('dismisses a todo message from the "first steps" list', () => {
    const input = { steps: { stepId1: true } };
    const result = settingsReducer.reducers.DISMISS_STEP(input, "stepId1");
    expect(result).toEqual({ steps: { stepId1: true } });
  });
});
