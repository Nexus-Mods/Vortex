import { describe, it, expect } from "vitest";

import { sessionReducer } from "./session";

describe("displayGroup", () => {
  it("sets the display item and creates missing nodes", () => {
    const input = {};
    const result = sessionReducer.reducers.DISPLAY_GROUP(input, {
      groupId: "someGroupId",
      itemId: "someItemId",
    });
    expect(result.displayGroups).toEqual({ someGroupId: "someItemId" });
  });
});
