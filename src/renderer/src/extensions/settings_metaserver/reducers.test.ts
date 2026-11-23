import { describe, it, expect } from "vitest";

import { addMetaserver, removeMetaserver } from "./actions";
import settingsReducer from "./reducers";

describe("addMetaserver", () => {
  it("adds a Metaserver", () => {
    const input = {
      servers: { id1: { url: "url", cacheDurationSec: 86400, priority: 1 } },
    };
    const result = settingsReducer.reducers.ADD_METASERVER(
      input,
      addMetaserver("id1", "new url").payload,
    );
    expect(result).toEqual({
      servers: {
        id1: { url: "new url", cacheDurationSec: 86400, priority: 1 },
      },
    });
  });
});

describe("removeMetaserver", () => {
  it("removes a Metaserver", () => {
    const input = { servers: { id1: { url: "url", cacheDurationSec: 86400, priority: 0 } } };
    const result = settingsReducer.reducers.REMOVE_METASERVER(
      input,
      removeMetaserver("id1").payload,
    );
    expect(result).toEqual({ servers: {} });
  });
});
