import { describe, it, expect } from "vitest";

import reducer, { sessionReducer } from "./reducers";

describe("setUpdateChannel", () => {
  it("sets the Update Channel", () => {
    const input = { channel: "value" };
    const result = reducer.reducers.SET_UPDATE_CHANNEL(input, "new value");
    expect(result).toEqual({ channel: "new value" });
  });
});

describe("setUpdaterSnapshot", () => {
  it("stores the latest polled snapshot in session state", () => {
    const snapshot = {
      state: { type: "downloading", version: "2.7.0", kind: "update", manual: true },
    };
    const result = sessionReducer.reducers.SET_UPDATER_SNAPSHOT({}, snapshot);
    expect(result).toEqual({ snapshot });
  });
});
