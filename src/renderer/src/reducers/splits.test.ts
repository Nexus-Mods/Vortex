import { describe, expect, it } from "vitest";

import { splitReducer } from "./splits";

describe("setSplit", () => {
  it("remembers where a split was left", () => {
    const result = splitReducer.reducers.SET_SPLIT({}, { splitId: "browse-mods", split: 0.6 });

    expect(result).toEqual({ "browse-mods": 0.6 });
  });

  it("moves a split already remembered, leaving the others alone", () => {
    const result = splitReducer.reducers.SET_SPLIT(
      { "browse-mods": 0.6, other: 0.4 },
      { splitId: "browse-mods", split: 0.35 },
    );

    expect(result).toEqual({ "browse-mods": 0.35, other: 0.4 });
  });
});
