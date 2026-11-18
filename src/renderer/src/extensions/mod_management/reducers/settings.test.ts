import { describe, it, expect } from "vitest";

import { settingsReducer } from "./settings";

/** The mods settings at their defaults, with what a test sets. */
const settings = (changes: object) => ({ ...settingsReducer.defaults, ...changes });

describe("setInstallPath", () => {
  it("sets the install path for a game", () => {
    const input = settings({ installPath: { gameId1: "path" } });
    const result = settingsReducer.reducers.SET_MOD_INSTALL_PATH(input, {
      gameId: "gameId1",
      path: "New path",
    });
    expect(result).toEqual(settings({ installPath: { gameId1: "New path" } }));
  });
  it("creates a new game and add the new path under if the game doesn't exist", () => {
    const input = settings({ installPath: { gameId1: "path" } });
    const result = settingsReducer.reducers.SET_MOD_INSTALL_PATH(input, {
      gameId: "gameId2",
      path: "New path",
    });
    expect(result).toEqual(
      settings({
        installPath: { gameId1: "path", gameId2: "New path" },
      }),
    );
  });
  it("affects only the right game", () => {
    const input = settings({ installPath: { gameId1: "path", gameId2: "path2" } });
    const result = settingsReducer.reducers.SET_MOD_INSTALL_PATH(input, {
      gameId: "gameId1",
      path: "New path",
    });
    expect(result).toEqual(
      settings({
        installPath: { gameId1: "New path", gameId2: "path2" },
      }),
    );
  });
});

describe("setActivator", () => {
  it("sets the activator to use for this game", () => {
    const input = settings({ activator: { gameId1: { activatorId1: "id" } } });
    const result = settingsReducer.reducers.SET_ACTIVATOR(input, {
      gameId: "gameId1",
      activatorId: "activatorId1",
    });
    expect(result).toEqual(settings({ activator: { gameId1: "activatorId1" } }));
  });
  it("adds the new game and sets the activator to use if the game doesn't exist", () => {
    const input = settings({ activator: { gameId1: { activatorId1: "id" } } });
    const newActivator = {
      id: "activatorId2",
    };
    const result = settingsReducer.reducers.SET_ACTIVATOR(input, {
      gameId: "gameId2",
      activatorId: newActivator,
    });
    expect(result).toEqual(
      settings({
        activator: { gameId1: { activatorId1: "id" }, gameId2: newActivator },
      }),
    );
  });
  it("affects only the right game", () => {
    const input = settings({
      activator: {
        gameId1: { activatorId1: "id" },
        gameId2: { activatorId2: "id2" },
      },
    });
    const result = settingsReducer.reducers.SET_ACTIVATOR(input, {
      gameId: "gameId1",
      activatorId: "activatorId1",
    });
    expect(result).toEqual(
      settings({
        activator: { gameId1: "activatorId1", gameId2: { activatorId2: "id2" } },
      }),
    );
  });
});

describe("setBetaModsTable", () => {
  it("switches the beta Mods table on and off", () => {
    const on = settingsReducer.reducers.SET_BETA_MODS_TABLE(settings({ betaTable: false }), true);
    expect(on).toEqual(settings({ betaTable: true }));

    expect(settingsReducer.reducers.SET_BETA_MODS_TABLE(on, false)).toEqual(
      settings({ betaTable: false }),
    );
  });

  it("is off by default", () => {
    expect(settingsReducer.defaults.betaTable).toBe(false);
  });
});

describe("setModsTablePropertiesOpen", () => {
  it("remembers whether the Properties panel is open", () => {
    const open = settingsReducer.reducers.SET_MODS_TABLE_PROPERTIES_OPEN(
      settings({ propertiesOpen: false }),
      true,
    );
    expect(open).toEqual(settings({ propertiesOpen: true }));

    expect(settingsReducer.reducers.SET_MODS_TABLE_PROPERTIES_OPEN(open, false)).toEqual(
      settings({
        propertiesOpen: false,
      }),
    );
  });

  it("is closed by default", () => {
    expect(settingsReducer.defaults.propertiesOpen).toBe(false);
  });
});
