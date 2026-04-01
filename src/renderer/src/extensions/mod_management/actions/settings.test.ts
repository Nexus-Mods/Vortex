import { describe, it, expect } from "vitest";

import * as settingsActions from "./settings";

describe("setPath", () => {
  it("creates the correct action", () => {
    expect(settingsActions.setInstallPath("gameId1", "path1")).toEqual({
      error: false,
      type: "SET_MOD_INSTALL_PATH",
      payload: { gameId: "gameId1", path: "path1" },
    });
  });
});

describe("setActivator", () => {
  it("creates the correct action", () => {
    expect(settingsActions.setActivator("gameId1", "activatorId1")).toEqual({
      error: false,
      type: "SET_ACTIVATOR",
      payload: { gameId: "gameId1", activatorId: "activatorId1" },
    });
  });
});
