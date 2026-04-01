import { describe, it, expect } from "vitest";

import type { ISavegame } from "../types/ISavegame";

import * as sessionActions from "./session";

describe("setSavegames", () => {
  it("creates the correct action", () => {
    const savegame: ISavegame = {
      id: "savegame1",
      filePath: "/saves/save1.ess",
      fileSize: 1024,
      attributes: {},
    };
    expect(sessionActions.setSavegames([savegame], false)).toEqual({
      error: false,
      type: "SET_SAVEGAMES",
      payload: {
        savegames: [savegame],
        truncated: false,
      },
    });
  });
});

describe("updateSavegame", () => {
  it("creates the correct action", () => {
    const savegame: ISavegame = {
      id: "savegame1",
      filePath: "/saves/save1.ess",
      fileSize: 2048,
      attributes: { level: 10 },
    };
    expect(sessionActions.updateSavegame("savegame1", savegame)).toEqual({
      error: false,
      type: "UPDATE_SAVEGAME",
      payload: { id: "savegame1", saveGame: savegame },
    });
  });
});

describe("setSavegameAttribute", () => {
  it("creates the correct action", () => {
    expect(
      sessionActions.setSavegameAttribute(
        "savegame1",
        "attribute1",
        "new value",
      ),
    ).toEqual({
      error: false,
      type: "SET_SAVEGAME_ATTRIBUTE",
      payload: { id: "savegame1", attribute: "attribute1", value: "new value" },
    });
  });
});

describe("clearSavegames", () => {
  it("creates the correct action", () => {
    expect(sessionActions.clearSavegames()).toEqual({
      error: false,
      type: "CLEAR_SAVEGAMES",
      payload: undefined,
    });
  });
});

describe("removeSavegame", () => {
  it("creates the correct action", () => {
    expect(sessionActions.removeSavegame("savegame1")).toEqual({
      error: false,
      type: "REMOVE_SAVEGAME",
      payload: "savegame1",
    });
  });
});

describe("setSavegamePath", () => {
  it("creates the correct action", () => {
    expect(sessionActions.setSavegamePath("savegamePath1")).toEqual({
      error: false,
      type: "SET_SAVEGAME_PATH",
      payload: "savegamePath1",
    });
  });
});
