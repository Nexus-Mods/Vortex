import { describe, it, expect } from "vitest";

import { verify } from "../../../reducers/verify";
import { modsReducer } from "./mods";

const noEmit = (): void => undefined;

describe("removeMod", () => {
  it("removes the mod", () => {
    const input = { gameId1: { modId1: "id" } };
    const result = modsReducer.reducers.REMOVE_MOD(input, {
      gameId: "gameId1",
      modId: "modId1",
    });
    expect(result).toEqual({ gameId1: {} });
  });
  it("does nothing if the game doesn't exist", () => {
    const input = { gameId1: { modId1: "id" } };
    const result = modsReducer.reducers.REMOVE_MOD(input, {
      gameId: "gameId2",
      modId: "modId1",
    });
    expect(result).toEqual({ gameId1: { modId1: "id" } });
  });
  it("affects only the right game", () => {
    const input = { gameId1: { modId1: "id" }, gameId2: { modId1: "id" } };
    const result = modsReducer.reducers.REMOVE_MOD(input, {
      gameId: "gameId1",
      modId: "modId1",
    });
    expect(result).toEqual({ gameId1: {}, gameId2: { modId1: "id" } });
  });
});

describe("setModInstallationPath", () => {
  it("sets the mod installation path", () => {
    const input = { gameId1: { modId1: { installationPath: "installPath" } } };
    const result = modsReducer.reducers.SET_MOD_INSTALLATION_PATH(input, {
      gameId: "gameId1",
      modId: "modId1",
      installPath: "New installPath",
    });
    expect(result).toEqual({
      gameId1: { modId1: { installationPath: "New installPath" } },
    });
  });
  it("does nothing if the game doesn't exist", () => {
    const input = { gameId1: { modId1: { installationPath: "installPath" } } };
    const result = modsReducer.reducers.SET_MOD_INSTALLATION_PATH(input, {
      gameId: "gameId2",
      modId: "modId1",
      installPath: "New installPath",
    });
    expect(result).toEqual({
      gameId1: { modId1: { installationPath: "installPath" } },
    });
  });
  it("affects only the right game", () => {
    const input = {
      gameId1: { modId1: { installationPath: "installPath" } },
      gameId2: { modId1: { installationPath: "installPath" } },
    };
    const result = modsReducer.reducers.SET_MOD_INSTALLATION_PATH(input, {
      gameId: "gameId1",
      modId: "modId1",
      installPath: "New installPath",
    });
    expect(result).toEqual({
      gameId1: { modId1: { installationPath: "New installPath" } },
      gameId2: { modId1: { installationPath: "installPath" } },
    });
  });
});

describe("setModAttribute", () => {
  it("sets the mod attribute", () => {
    const input = {
      gameId1: { modId1: { attributes: { attribute1: "value" } } },
    };
    const result = modsReducer.reducers.SET_MOD_ATTRIBUTE(input, {
      gameId: "gameId1",
      modId: "modId1",
      attribute: "attribute1",
      value: "new value",
    });
    expect(result).toEqual({
      gameId1: { modId1: { attributes: { attribute1: "new value" } } },
    });
  });
  it("works if there were no attributes before", () => {
    const input = { gameId1: { modId1: {} } };
    const result = modsReducer.reducers.SET_MOD_ATTRIBUTE(input, {
      gameId: "gameId1",
      modId: "modId1",
      attribute: "attribute1",
      value: "new value",
    });
    expect(result).toEqual({
      gameId1: { modId1: { attributes: { attribute1: "new value" } } },
    });
  });
  it("does nothing if the game doesn't exist", () => {
    const input = {
      gameId1: { modId1: { attributes: { attribute1: "value" } } },
    };
    const result = modsReducer.reducers.SET_MOD_ATTRIBUTE(input, {
      gameId: "gameId2",
      modId: "modId1",
      attribute: "attribute1",
      value: "new value",
    });
    expect(result).toEqual({
      gameId1: { modId1: { attributes: { attribute1: "value" } } },
    });
  });
  it("affects only the right game", () => {
    const input = {
      gameId1: { modId1: { attributes: { attribute1: "value" } } },
      gameId2: { modId1: { attributes: { attribute1: "value" } } },
    };
    const result = modsReducer.reducers.SET_MOD_ATTRIBUTE(input, {
      gameId: "gameId1",
      modId: "modId1",
      attribute: "attribute1",
      value: "new value",
    });
    expect(result).toEqual({
      gameId1: { modId1: { attributes: { attribute1: "new value" } } },
      gameId2: { modId1: { attributes: { attribute1: "value" } } },
    });
  });
});

describe("setModAttributes", () => {
  it("sets the mod attributes", () => {
    const input = {
      gameId1: { modId1: { attributes: { attribute1: "value" } } },
    };
    const result = modsReducer.reducers.SET_MOD_ATTRIBUTES(input, {
      gameId: "gameId1",
      modId: "modId1",
      attributes: {
        attribute1: "new value",
      },
    });
    expect(result).toEqual({
      gameId1: { modId1: { attributes: { attribute1: "new value" } } },
    });
  });
  it("works if there were no attributes before", () => {
    const input = { gameId1: { modId1: {} } };
    const result = modsReducer.reducers.SET_MOD_ATTRIBUTES(input, {
      gameId: "gameId1",
      modId: "modId1",
      attributes: {
        attribute1: "new value",
      },
    });
    expect(result).toEqual({
      gameId1: { modId1: { attributes: { attribute1: "new value" } } },
    });
  });
  it("does nothing if the game doesn't exist", () => {
    const input = {
      gameId1: { modId1: { attributes: { attribute1: "value" } } },
    };
    const result = modsReducer.reducers.SET_MOD_ATTRIBUTES(input, {
      gameId: "gameId2",
      modId: "modId1",
      attributes: {
        attribute1: "new value",
      },
    });
    expect(result).toEqual({
      gameId1: { modId1: { attributes: { attribute1: "value" } } },
    });
  });
  it("affects only the right game", () => {
    const input = {
      gameId1: { modId1: { attributes: { attribute1: "value" } } },
      gameId2: { modId1: { attributes: { attribute1: "value" } } },
    };
    const result = modsReducer.reducers.SET_MOD_ATTRIBUTES(input, {
      gameId: "gameId1",
      modId: "modId1",
      attributes: {
        attribute1: "new value",
      },
    });
    expect(result).toEqual({
      gameId1: { modId1: { attributes: { attribute1: "new value" } } },
      gameId2: { modId1: { attributes: { attribute1: "value" } } },
    });
  });
  it("can set multiple attributes", () => {
    const input = {
      gameId1: { modId1: { attributes: { attribute1: "value" } } },
    };
    const result = modsReducer.reducers.SET_MOD_ATTRIBUTES(input, {
      gameId: "gameId1",
      modId: "modId1",
      attributes: {
        attribute1: "new value",
        attribute2: "value2",
      },
    });
    expect(result).toEqual({
      gameId1: {
        modId1: {
          attributes: { attribute1: "new value", attribute2: "value2" },
        },
      },
    });
  });
  it("doesn't change unaffected attributes", () => {
    const input = {
      gameId1: { modId1: { attributes: { attribute1: "value" } } },
    };
    const result = modsReducer.reducers.SET_MOD_ATTRIBUTES(input, {
      gameId: "gameId1",
      modId: "modId1",
      attributes: {
        attribute2: "value2",
        attribute3: "value3",
      },
    });
    expect(result).toEqual({
      gameId1: {
        modId1: {
          attributes: {
            attribute1: "value",
            attribute2: "value2",
            attribute3: "value3",
          },
        },
      },
    });
  });
});

describe("setModState", () => {
  it("sets the mod state", () => {
    const input = { gameId1: { modId1: { state: "value" } } };
    const result = modsReducer.reducers.SET_MOD_STATE(input, {
      gameId: "gameId1",
      modId: "modId1",
      modState: "new value",
    });
    expect(result).toEqual({ gameId1: { modId1: { state: "new value" } } });
  });
  it("does nothing if the game doesn't exist", () => {
    const input = { gameId1: { modId1: { state: "value" } } };
    const result = modsReducer.reducers.SET_MOD_STATE(input, {
      gameId: "gameId2",
      modId: "modId1",
      modState: "new value",
    });
    expect(result).toEqual({ gameId1: { modId1: { state: "value" } } });
  });
  it("affects only the right game", () => {
    const input = {
      gameId1: { modId1: { state: "value" } },
      gameId2: { modId1: { state: "value" } },
    };
    const result = modsReducer.reducers.SET_MOD_STATE(input, {
      gameId: "gameId1",
      modId: "modId1",
      modState: "new value",
    });
    expect(result).toEqual({
      gameId1: { modId1: { state: "new value" } },
      gameId2: { modId1: { state: "value" } },
    });
  });
});

describe("addMod", () => {
  it("adds a new mod", () => {
    const input = {
      gameId1: {
        modId1: { state: "", id: "", installationPath: "", attributes: {} },
      },
    };
    const mod = {
      state: "installing",
      id: "modId1",
      installationPath: "path",
      attributes: {},
    };
    const result = modsReducer.reducers.ADD_MOD(input, {
      gameId: "gameId1",
      mod: mod,
    });
    expect(result).toEqual({ gameId1: { modId1: mod } });
  });
  it("creates a new game and add the new mod under if the game doesn't exist", () => {
    const input = {
      gameId1: {
        modId1: { state: "", id: "", installationPath: "", attributes: {} },
      },
    };
    const mod = {
      state: "installing",
      id: "modId1",
      installationPath: "path",
      attributes: {},
    };
    const oldMod = {
      state: "",
      id: "",
      installationPath: "",
      attributes: {},
    };
    const result = modsReducer.reducers.ADD_MOD(input, {
      gameId: "gameId2",
      mod: mod,
    });
    expect(result).toEqual({
      gameId1: { modId1: oldMod },
      gameId2: { modId1: mod },
    });
  });
  it("affects only the right game", () => {
    const input = {
      gameId1: {
        modId1: { state: "", id: "", installationPath: "", attributes: {} },
      },
      gameId2: {
        modId1: { state: "", id: "", installationPath: "", attributes: {} },
      },
    };
    const mod = {
      state: "installing",
      id: "modId1",
      installationPath: "path",
      attributes: {},
    };
    const oldMod = {
      state: "",
      id: "",
      installationPath: "",
      attributes: {},
    };
    const result = modsReducer.reducers.ADD_MOD(input, {
      gameId: "gameId1",
      mod: mod,
    });
    expect(result).toEqual({
      gameId1: { modId1: mod },
      gameId2: { modId1: oldMod },
    });
  });
});

describe("verifiers: installationPath self-heal (GH#23363/#23355)", () => {
  it("recovers installationPath from the modId instead of dropping the mod", () => {
    // a mod that lost its installationPath (and id) leaf to a partial write,
    // keeping only archiveId + attributes - the #23363 corruption shape.
    const state = {
      skyrimse: {
        "Fences of Skyrim-123-1-0-17000": {
          archiveId: "arch1",
          attributes: { endorsed: "Undecided", allowRating: true, version: "1.0" },
        },
      },
    };

    const result = verify(
      "persistent.mods",
      modsReducer.verifiers,
      state,
      modsReducer.defaults,
      noEmit,
    );

    const mod = result?.skyrimse?.["Fences of Skyrim-123-1-0-17000"];
    // record preserved (not culled) and installationPath healed to the modId
    expect(mod).toBeDefined();
    expect(mod.installationPath).toBe("Fences of Skyrim-123-1-0-17000");
    expect(mod.archiveId).toBe("arch1");
    expect(mod.attributes).toEqual({ endorsed: "Undecided", allowRating: true, version: "1.0" });
  });

  it("leaves a valid mod untouched", () => {
    const state = {
      skyrimse: {
        modA: {
          id: "modA",
          type: "",
          installationPath: "modA",
          state: "installed",
          attributes: { name: "Mod A" },
        },
      },
    };

    const result = verify(
      "persistent.mods",
      modsReducer.verifiers,
      state,
      modsReducer.defaults,
      noEmit,
    );

    expect(result.skyrimse.modA.installationPath).toBe("modA");
  });

  it("still drops a mod entry that isn't an object", () => {
    const state = { skyrimse: { good: { installationPath: "good" }, bad: "not an object" } };

    const result = verify(
      "persistent.mods",
      modsReducer.verifiers,
      state,
      modsReducer.defaults,
      noEmit,
    );

    expect(result.skyrimse.good.installationPath).toBe("good");
    expect(result.skyrimse).not.toHaveProperty("bad");
  });
});
