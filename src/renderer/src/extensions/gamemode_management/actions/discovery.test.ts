import { describe, it, expect } from "vitest";

import * as discoveryActions from "./discovery";

describe("discoveryProgress", () => {
  it("creates the correct action", () => {
    expect(discoveryActions.discoveryProgress(0, 42, "dir")).toEqual({
      error: false,
      type: "DISCOVERY_PROGRESS",
      payload: { idx: 0, percent: 42, directory: "dir" },
    });
  });
});
