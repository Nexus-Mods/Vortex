import { describe, it, expect } from "vitest";

import * as actions from "./actions";

describe("addMetaserver", () => {
  it("creates the correct action", () => {
    expect(actions.addMetaserver("id1", "url1")).toEqual({
      error: false,
      type: "ADD_METASERVER",
      payload: { id: "id1", url: "url1" },
    });
  });
});

describe("removeMetaserver", () => {
  it("creates the correct action", () => {
    expect(actions.removeMetaserver("id1")).toEqual({
      error: false,
      type: "REMOVE_METASERVER",
      payload: { id: "id1", cacheDurationSec: undefined },
    });
  });
});
