import { describe, it, expect } from "vitest";

import * as actions from "./actions";

describe("setUpdateChannel", () => {
  it("sets the Update Channel", () => {
    expect(actions.setUpdateChannel("new value")).toEqual({
      error: false,
      type: "SET_UPDATE_CHANNEL",
      payload: "new value",
    });
  });
});
