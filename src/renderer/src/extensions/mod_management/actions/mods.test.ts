import { describe, it, expect } from "vitest";

import * as modsActions from "./mods";

describe("addMod", () => {
  it("creates the correct action", () => {
    const mod1 = {
      id: "mod1",
      state: "installed" as const,
      type: "",
      installationPath: "mod1",
    };
    expect(modsActions.addMod("gameId1", mod1)).toEqual({
      error: false,
      type: "ADD_MOD",
      payload: { gameId: "gameId1", mod: mod1 },
    });
  });
});

describe("removeMod", () => {
  it("creates the correct action", () => {
    expect(modsActions.removeMod("gameId1", "modId1")).toEqual({
      error: false,
      type: "REMOVE_MOD",
      payload: { gameId: "gameId1", modId: "modId1" },
    });
  });
});

describe("setModState", () => {
  it("creates the correct action", () => {
    expect(modsActions.setModState("gameId1", "modId1", "installed")).toEqual({
      error: false,
      type: "SET_MOD_STATE",
      payload: { gameId: "gameId1", modId: "modId1", modState: "installed" },
    });
  });
});

describe("setModInstallationPath", () => {
  it("creates the correct action", () => {
    expect(
      modsActions.setModInstallationPath("gameId1", "modId1", "installPath1"),
    ).toEqual({
      error: false,
      type: "SET_MOD_INSTALLATION_PATH",
      payload: {
        gameId: "gameId1",
        modId: "modId1",
        installPath: "installPath1",
      },
    });
  });
});

describe("setModAttribute", () => {
  it("creates the correct action", () => {
    expect(
      modsActions.setModAttribute("gameId1", "modId1", "attribute1", "value1"),
    ).toEqual({
      error: false,
      type: "SET_MOD_ATTRIBUTE",
      payload: {
        gameId: "gameId1",
        modId: "modId1",
        attribute: "attribute1",
        value: "value1",
      },
    });
  });
});

describe("setModAttributes", () => {
  it("creates the correct action", () => {
    expect(
      modsActions.setModAttributes("gameId1", "modId1", {
        attribute1: "value1",
        attribute2: "value2",
      }),
    ).toEqual({
      error: false,
      type: "SET_MOD_ATTRIBUTES",
      payload: {
        gameId: "gameId1",
        modId: "modId1",
        attributes: { attribute1: "value1", attribute2: "value2" },
      },
    });
  });
});
