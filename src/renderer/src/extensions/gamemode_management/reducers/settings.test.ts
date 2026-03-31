import { describe, it, expect } from "vitest";

import type { IDiscoveredTool } from "../../../types/IDiscoveredTool";
import type { ISettingsGameMode } from "../../../types/IState";
import type { IDiscoveryResult } from "../types/IDiscoveryResult";

import { settingsReducer } from "./settings";

function makeTool(overrides: Partial<IDiscoveredTool> = {}): IDiscoveredTool {
  return {
    id: "toolId1",
    name: "Tool",
    executable: () => "tool.exe",
    requiredFiles: [],
    path: "",
    hidden: false,
    custom: false,
    ...overrides,
  };
}

function makeGame(overrides: Partial<IDiscoveryResult> = {}): IDiscoveryResult {
  return { ...overrides };
}

function makeSettings(
  discovered: Record<string, IDiscoveryResult>,
): ISettingsGameMode {
  return {
    discovered,
    searchPaths: [],
    pickerLayout: "list",
    sortManaged: "name",
    sortUnmanaged: "name",
  };
}

describe("setToolVisible", () => {
  it("sets the tool visible", () => {
    const input = makeSettings({
      gameId1: makeGame({
        tools: { toolId1: makeTool({ hidden: false }) },
      }),
    });
    const result = settingsReducer.reducers.SET_TOOL_VISIBLE(input, {
      gameId: "gameId1",
      toolId: "toolId1",
      value: true,
    });
    expect(result.discovered.gameId1.tools.toolId1.hidden).toBe(true);
  });

  it("adds the new tool and set it visible if the tool doesn't exist", () => {
    const input = makeSettings({
      gameId1: makeGame({
        tools: { toolId1: makeTool({ hidden: false }) },
      }),
    });
    const result = settingsReducer.reducers.SET_TOOL_VISIBLE(input, {
      gameId: "gameId1",
      toolId: "toolId2",
      value: true,
    });
    expect(result.discovered.gameId1.tools.toolId1.hidden).toBe(false);
    expect(result.discovered.gameId1.tools.toolId2.hidden).toBe(true);
  });

  it("creates a new game and add the new visible tool under if the game doesn't exist", () => {
    const input = makeSettings({
      gameId1: makeGame({
        tools: { toolId1: makeTool({ hidden: false }) },
      }),
    });
    const result = settingsReducer.reducers.SET_TOOL_VISIBLE(input, {
      gameId: "gameId2",
      toolId: "toolId1",
      value: true,
    });
    expect(result.discovered.gameId1.tools.toolId1.hidden).toBe(false);
    expect(result.discovered.gameId2.tools.toolId1.hidden).toBe(true);
  });

  it("affects only the right game", () => {
    const input = makeSettings({
      gameId1: makeGame({
        tools: { toolId1: makeTool({ hidden: false }) },
      }),
      gameId2: makeGame({
        tools: { toolId1: makeTool({ hidden: false }) },
      }),
    });
    const result = settingsReducer.reducers.SET_TOOL_VISIBLE(input, {
      gameId: "gameId1",
      toolId: "toolId1",
      value: true,
    });
    expect(result.discovered.gameId1.tools.toolId1.hidden).toBe(true);
    expect(result.discovered.gameId2.tools.toolId1.hidden).toBe(false);
  });
});

describe("setGameHidden", () => {
  it("sets the game hidden", () => {
    const input = makeSettings({
      gameId1: makeGame({ hidden: false }),
    });
    const result = settingsReducer.reducers.SET_GAME_HIDDEN(input, {
      gameId: "gameId1",
      hidden: true,
    });
    expect(result.discovered.gameId1.hidden).toBe(true);
  });

  it("creates a new game and set it visible if the game doesn't exist", () => {
    const input = makeSettings({
      gameId1: makeGame({ hidden: false }),
    });
    const result = settingsReducer.reducers.SET_GAME_HIDDEN(input, {
      gameId: "gameId2",
      hidden: true,
    });
    expect(result.discovered.gameId1.hidden).toBe(false);
    expect(result.discovered.gameId2.hidden).toBe(true);
  });

  it("affects only the right game", () => {
    const input = makeSettings({
      gameId1: makeGame({ hidden: false }),
      gameId2: makeGame({ hidden: false }),
    });
    const result = settingsReducer.reducers.SET_GAME_HIDDEN(input, {
      gameId: "gameId1",
      hidden: true,
    });
    expect(result.discovered.gameId1.hidden).toBe(true);
    expect(result.discovered.gameId2.hidden).toBe(false);
  });
});

describe("setGameParameters", () => {
  it("sets the game parameters", () => {
    const input = makeSettings({
      gameId1: makeGame({
        environment: { OLD: "env" },
      }),
    });
    const gameParameters = {
      environment: { NEW: "env" },
    };
    const result = settingsReducer.reducers.SET_GAME_PARAMETERS(input, {
      gameId: "gameId1",
      parameters: gameParameters,
    });
    expect(result.discovered.gameId1.environment).toEqual({ NEW: "env" });
  });

  it("does nothing if the game doesn't exist", () => {
    const input = makeSettings({
      gameId1: makeGame({
        environment: { OLD: "env" },
      }),
    });
    const result = settingsReducer.reducers.SET_GAME_PARAMETERS(input, {
      gameId: "gameId2",
      parameters: { environment: { NEW: "env" } },
    });
    expect(result.discovered.gameId1.environment).toEqual({ OLD: "env" });
    expect(result.discovered.gameId2).toBeUndefined();
  });

  it("affects only the right game", () => {
    const input = makeSettings({
      gameId1: makeGame({ environment: { OLD: "env" } }),
      gameId2: makeGame({ environment: { OLD: "env" } }),
    });
    const result = settingsReducer.reducers.SET_GAME_PARAMETERS(input, {
      gameId: "gameId1",
      parameters: { environment: { NEW: "env" } },
    });
    expect(result.discovered.gameId1.environment).toEqual({ NEW: "env" });
    expect(result.discovered.gameId2.environment).toEqual({ OLD: "env" });
  });
});

describe("addDiscoveredGame", () => {
  it("updates the discovered game params", () => {
    const input = makeSettings({
      gameId1: makeGame({ path: "path1" }),
    });
    const result = settingsReducer.reducers.ADD_DISCOVERED_GAME(input, {
      id: "gameId1",
      result: makeGame({ path: "path2" }),
    });
    expect(result.discovered.gameId1.path).toBe("path2");
  });

  it("adds the new game if the game doesn't exist", () => {
    const input = makeSettings({
      gameId1: makeGame({ path: "path1" }),
    });
    const result = settingsReducer.reducers.ADD_DISCOVERED_GAME(input, {
      id: "gameId2",
      result: makeGame({ path: "path2" }),
    });
    expect(result.discovered.gameId1.path).toBe("path1");
    expect(result.discovered.gameId2.path).toBe("path2");
  });

  it("affects only the right game", () => {
    const input = makeSettings({
      gameId1: makeGame({ path: "path1" }),
      gameId2: makeGame({ path: "path1" }),
    });
    const result = settingsReducer.reducers.ADD_DISCOVERED_GAME(input, {
      id: "gameId1",
      result: makeGame({ path: "path2" }),
    });
    expect(result.discovered.gameId1.path).toBe("path2");
    expect(result.discovered.gameId2.path).toBe("path1");
  });
});

describe("addDiscoveredTool", () => {
  it("updates the discovered tool params", () => {
    const input = makeSettings({
      gameId1: makeGame({
        tools: {
          toolId1: makeTool({ path: "tool1 path", custom: false }),
        },
      }),
    });
    const newTool = makeTool({ path: "tool2 path", custom: true });
    const result = settingsReducer.reducers.ADD_DISCOVERED_TOOL(input, {
      gameId: "gameId1",
      toolId: "toolId1",
      result: newTool,
    });
    expect(result.discovered.gameId1.tools.toolId1.path).toBe("tool2 path");
    expect(result.discovered.gameId1.tools.toolId1.custom).toBe(true);
  });

  it("affects only the right game", () => {
    const oldTool = makeTool({ path: "tool1 path", custom: false });
    const input = makeSettings({
      gameId1: makeGame({
        tools: { toolId1: { ...oldTool } },
      }),
      gameId2: makeGame({
        tools: { toolId1: { ...oldTool } },
      }),
    });
    const newTool = makeTool({ path: "tool2 path", custom: true });
    const result = settingsReducer.reducers.ADD_DISCOVERED_TOOL(input, {
      gameId: "gameId1",
      toolId: "toolId1",
      result: newTool,
    });
    expect(result.discovered.gameId1.tools.toolId1.path).toBe("tool2 path");
    expect(result.discovered.gameId2.tools.toolId1.path).toBe("tool1 path");
  });
});
