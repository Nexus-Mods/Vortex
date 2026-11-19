import { describe, it, expect } from "vitest";

import type { ISavegame } from "../types/ISavegame";
import type { IStateSavegame } from "../types/IStateSavegame";
import { sessionReducer } from "./session";

function makeState(fields: Partial<IStateSavegame>): IStateSavegame {
  return { ...sessionReducer.defaults, ...fields };
}

function makeSave(id: string, attributes: { [id: string]: any } = {}): ISavegame {
  return { id, filePath: `/saves/${id}.ess`, fileSize: 0, attributes };
}

describe("setSavegames", () => {
  it("sets the savegames", () => {
    const input = makeState({ saves: {} });
    const savegame = makeSave("savegame1");
    const result = sessionReducer.reducers.SET_SAVEGAMES(input, {
      savegames: { savegame1: savegame },
      truncated: false,
    });
    expect(result).toEqual(makeState({ saves: { savegame1: savegame }, savesTruncated: false }));
  });
  it("updates the list, replacing previously installed saves", () => {
    const input = makeState({
      saves: { old1: makeSave("old1"), old2: makeSave("old2") },
    });
    const newSavegame = makeSave("savegame1");
    const result = sessionReducer.reducers.SET_SAVEGAMES(input, {
      savegames: { savegame1: newSavegame },
      truncated: false,
    });
    expect(result).toEqual(makeState({ saves: { savegame1: newSavegame }, savesTruncated: false }));
  });
});

describe("updateSavegame", () => {
  it("sets the savegame state", () => {
    const input = makeState({ saves: { savegame1: makeSave("savegame1") } });
    const newSave = makeSave("savegame1", { level: 2 });
    const result = sessionReducer.reducers.UPDATE_SAVEGAME(input, {
      id: "savegame1",
      saveGame: newSave,
    });
    expect(result).toEqual(makeState({ saves: { savegame1: newSave } }));
  });
  it("affects only the right savegame", () => {
    const input = makeState({
      saves: { savegame1: makeSave("savegame1"), savegame2: makeSave("savegame2") },
    });
    const newSave = makeSave("savegame1", { level: 2 });
    const result = sessionReducer.reducers.UPDATE_SAVEGAME(input, {
      id: "savegame1",
      saveGame: newSave,
    });
    expect(result).toEqual(
      makeState({ saves: { savegame1: newSave, savegame2: makeSave("savegame2") } }),
    );
  });
});

describe("setSavegameAttribute", () => {
  it("sets the savegame attribute", () => {
    const input = makeState({
      saves: { savegame1: makeSave("savegame1", { attribute1: "value" }) },
    });
    const result = sessionReducer.reducers.SET_SAVEGAME_ATTRIBUTE(input, {
      id: "savegame1",
      attribute: "attribute1",
      value: "new value",
    });
    expect(result).toEqual(
      makeState({
        saves: { savegame1: makeSave("savegame1", { attribute1: "new value" }) },
      }),
    );
  });
  it("affects only the right savegame", () => {
    const input = makeState({
      saves: {
        savegame1: makeSave("savegame1", { attribute1: "value" }),
        savegame2: makeSave("savegame2", { attribute1: "value" }),
      },
    });
    const result = sessionReducer.reducers.SET_SAVEGAME_ATTRIBUTE(input, {
      id: "savegame1",
      attribute: "attribute1",
      value: "new value",
    });
    expect(result).toEqual(
      makeState({
        saves: {
          savegame1: makeSave("savegame1", { attribute1: "new value" }),
          savegame2: makeSave("savegame2", { attribute1: "value" }),
        },
      }),
    );
  });
});

describe("clearSavegames", () => {
  it("clears the savegames", () => {
    const input = makeState({
      saves: { savegame1: makeSave("savegame1"), savegame2: makeSave("savegame2") },
    });
    const result = sessionReducer.reducers.CLEAR_SAVEGAMES(input, undefined);
    expect(result).toEqual(makeState({ saves: {} }));
  });
});

describe("setSavegamePath", () => {
  it("sets the savegame path", () => {
    const input = makeState({ savegamePath: "value" });
    const result = sessionReducer.reducers.SET_SAVEGAME_PATH(input, "new value");
    expect(result).toEqual(makeState({ savegamePath: "new value" }));
  });
});
