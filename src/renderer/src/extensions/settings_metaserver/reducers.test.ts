import { describe, it, expect } from "vitest";

import settingsReducer from "./reducers";

describe("addMetaserver", () => {
  it("adds a Metaserver", () => {
    const input = {
      servers: { id1: { url1: "url", cacheDurationSec: 86400, priority: 1 } },
    };
    const result = settingsReducer.reducers.ADD_METASERVER(input, {
      id: "id1",
      url: "new url",
    });
    expect(result).toEqual({
      servers: {
        id1: { url: "new url", cacheDurationSec: 86400, priority: 1 },
      },
    });
  });
});

describe("removeMetaserver", () => {
  it("removes a Metaserver", () => {
    const input = { servers: { id1: {} } };
    const result = settingsReducer.reducers.REMOVE_METASERVER(input, {
      id: "id1",
      cacheDurationSec: 86400,
    });
    expect(result).toEqual({ servers: {} });
  });
});
