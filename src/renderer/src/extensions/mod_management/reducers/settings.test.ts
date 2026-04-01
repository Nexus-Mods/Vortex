import { describe, it, expect } from "vitest";

import { settingsReducer } from "./settings";

describe("setInstallPath", () => {
  it("sets the install path for a game", () => {
    const input = { installPath: { gameId1: "path" } };
    const result = settingsReducer.reducers.SET_MOD_INSTALL_PATH(input, {
      gameId: "gameId1",
      path: "New path",
    });
    expect(result).toEqual({ installPath: { gameId1: "New path" } });
  });
  it("creates a new game and add the new path under if the game doesn't exist", () => {
    const input = { installPath: { gameId1: "path" } };
    const result = settingsReducer.reducers.SET_MOD_INSTALL_PATH(input, {
      gameId: "gameId2",
      path: "New path",
    });
    expect(result).toEqual({
      installPath: { gameId1: "path", gameId2: "New path" },
    });
  });
  it("affects only the right game", () => {
    const input = { installPath: { gameId1: "path", gameId2: "path2" } };
    const result = settingsReducer.reducers.SET_MOD_INSTALL_PATH(input, {
      gameId: "gameId1",
      path: "New path",
    });
    expect(result).toEqual({
      installPath: { gameId1: "New path", gameId2: "path2" },
    });
  });
});

describe("setActivator", () => {
  it("sets the activator to use for this game", () => {
    const input = { activator: { gameId1: { activatorId1: "id" } } };
    const result = settingsReducer.reducers.SET_ACTIVATOR(input, {
      gameId: "gameId1",
      activatorId: "activatorId1",
    });
    expect(result).toEqual({ activator: { gameId1: "activatorId1" } });
  });
  it("adds the new game and sets the activator to use if the game doesn't exist", () => {
    const input = { activator: { gameId1: { activatorId1: "id" } } };
    const newActivator = {
      id: "activatorId2",
    };
    const result = settingsReducer.reducers.SET_ACTIVATOR(input, {
      gameId: "gameId2",
      activatorId: newActivator,
    });
    expect(result).toEqual({
      activator: { gameId1: { activatorId1: "id" }, gameId2: newActivator },
    });
  });
  it("affects only the right game", () => {
    const input = {
      activator: {
        gameId1: { activatorId1: "id" },
        gameId2: { activatorId2: "id2" },
      },
    };
    const result = settingsReducer.reducers.SET_ACTIVATOR(input, {
      gameId: "gameId1",
      activatorId: "activatorId1",
    });
    expect(result).toEqual({
      activator: { gameId1: "activatorId1", gameId2: { activatorId2: "id2" } },
    });
  });
});
