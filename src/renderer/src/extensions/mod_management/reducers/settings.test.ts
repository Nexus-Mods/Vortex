import { describe, it, expect } from "vitest";

import type { ISettingsMods } from "../../../types/IState";
import { setActivator, setBetaModsTable, setInstallPath } from "../actions/settings";
import { settingsReducer } from "./settings";

const defaults: ISettingsMods = {
  installPath: {},
  modlistState: {},
  activator: {},
  installPathMode: "userData",
  suggestInstallPathDirectory: "Vortex Mods",
  showDropzone: true,
  confirmPurge: true,
  cleanupOnDeploy: false,
  installerSandbox: true,
  betaTable: false,
};

describe("setInstallPath", () => {
  it("sets the install path for a game", () => {
    const input = { ...defaults, installPath: { gameId1: "path" } };
    const result = settingsReducer.reducers.SET_MOD_INSTALL_PATH(
      input,
      setInstallPath("gameId1", "New path").payload,
    );
    expect(result).toEqual({ ...defaults, installPath: { gameId1: "New path" } });
  });
  it("creates a new game and add the new path under if the game doesn't exist", () => {
    const input = { ...defaults, installPath: { gameId1: "path" } };
    const result = settingsReducer.reducers.SET_MOD_INSTALL_PATH(
      input,
      setInstallPath("gameId2", "New path").payload,
    );
    expect(result).toEqual({
      ...defaults,
      installPath: { gameId1: "path", gameId2: "New path" },
    });
  });
  it("affects only the right game", () => {
    const input = { ...defaults, installPath: { gameId1: "path", gameId2: "path2" } };
    const result = settingsReducer.reducers.SET_MOD_INSTALL_PATH(
      input,
      setInstallPath("gameId1", "New path").payload,
    );
    expect(result).toEqual({
      ...defaults,
      installPath: { gameId1: "New path", gameId2: "path2" },
    });
  });
});

describe("setActivator", () => {
  it("sets the activator to use for this game", () => {
    const input = { ...defaults, activator: { gameId1: "oldActivator" } };
    const result = settingsReducer.reducers.SET_ACTIVATOR(
      input,
      setActivator("gameId1", "activatorId1").payload,
    );
    expect(result).toEqual({ ...defaults, activator: { gameId1: "activatorId1" } });
  });
  it("adds the new game and sets the activator to use if the game doesn't exist", () => {
    const input = { ...defaults, activator: { gameId1: "activatorId1" } };
    const result = settingsReducer.reducers.SET_ACTIVATOR(
      input,
      setActivator("gameId2", "activatorId2").payload,
    );
    expect(result).toEqual({
      ...defaults,
      activator: { gameId1: "activatorId1", gameId2: "activatorId2" },
    });
  });
  it("affects only the right game", () => {
    const input = {
      ...defaults,
      activator: { gameId1: "oldActivator1", gameId2: "activatorId2" },
    };
    const result = settingsReducer.reducers.SET_ACTIVATOR(
      input,
      setActivator("gameId1", "activatorId1").payload,
    );
    expect(result).toEqual({
      ...defaults,
      activator: { gameId1: "activatorId1", gameId2: "activatorId2" },
    });
  });
});

describe("setBetaModsTable", () => {
  it("switches the beta Mods table on and off", () => {
    const on = settingsReducer.reducers.SET_BETA_MODS_TABLE(
      { ...defaults, betaTable: false },
      setBetaModsTable(true).payload,
    );
    expect(on).toEqual({ ...defaults, betaTable: true });

    expect(
      settingsReducer.reducers.SET_BETA_MODS_TABLE(on, setBetaModsTable(false).payload),
    ).toEqual({ ...defaults, betaTable: false });
  });

  it("is off by default", () => {
    expect(settingsReducer.defaults.betaTable).toBe(false);
  });
});
