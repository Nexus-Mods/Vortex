import { describe, it, expect } from "vitest";

import { sessionReducer, defaultState } from "./session";

describe("displayGroup", () => {
  it("sets the display item and creates missing nodes", () => {
    const result = sessionReducer.reducers.DISPLAY_GROUP(defaultState, {
      groupId: "someGroupId",
      itemId: "someItemId",
    });
    expect(result.displayGroups).toEqual({ someGroupId: "someItemId" });
  });
});
