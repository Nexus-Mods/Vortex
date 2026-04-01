import { describe, it, expect } from "vitest";

import type { IDiscoveredTool } from "../../../types/IDiscoveredTool";
import type { IDiscoveryResult } from "../types/IDiscoveryResult";

import * as actions from "./settings";

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

describe("setToolVisible", () => {
  it("creates the correct action", () => {
    expect(actions.setToolVisible("gameId1", "toolId1", true)).toEqual({
      error: false,
      type: "SET_TOOL_VISIBLE",
      payload: { gameId: "gameId1", toolId: "toolId1", visible: true },
    });
  });
});

describe("setGameHidden", () => {
  it("creates the correct action", () => {
    expect(actions.setGameHidden("gameId1", true)).toEqual({
      error: false,
      type: "SET_GAME_HIDDEN",
      payload: { gameId: "gameId1", hidden: true },
    });
  });
});

describe("setGameParameters", () => {
  it("creates the correct action", () => {
    const parameters = {
      workingDirectory: "E:",
      iconPath: "new icon",
      environment: { KEY: "value" },
      commandLine: "new line",
    };

    expect(actions.setGameParameters("gameId1", parameters)).toEqual({
      error: false,
      type: "SET_GAME_PARAMETERS",
      payload: { gameId: "gameId1", parameters },
    });
  });
});

describe("addDiscoveredGame", () => {
  it("creates the correct action", () => {
    const result: IDiscoveryResult = {
      path: "path2",
      hidden: false,
      tools: {},
      environment: {},
    };

    expect(actions.addDiscoveredGame("gameId1", result)).toEqual({
      error: false,
      type: "ADD_DISCOVERED_GAME",
      payload: { id: "gameId1", result },
    });
  });
});

describe("addDiscoveredTool", () => {
  it("creates the correct action", () => {
    const result = makeTool({
      path: "tool2 path",
      hidden: false,
      custom: true,
      workingDirectory: "C:",
    });

    expect(
      actions.addDiscoveredTool("gameId1", "toolId1", result, false),
    ).toEqual({
      error: false,
      type: "ADD_DISCOVERED_TOOL",
      payload: { gameId: "gameId1", toolId: "toolId1", result, manual: false },
    });
  });
});
