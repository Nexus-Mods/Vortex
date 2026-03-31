import { describe, it, expect } from "vitest";

import reducer from "./reducers";

describe("setUpdateChannel", () => {
  it("sets the Update Channel", () => {
    const input = { channel: "value" };
    const result = reducer.reducers.SET_UPDATE_CHANNEL(input, "new value");
    expect(result).toEqual({ channel: "new value" });
  });
});
