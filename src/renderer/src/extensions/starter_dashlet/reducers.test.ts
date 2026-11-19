import { describe, it, expect } from "vitest";

import type { ISettingsInterface } from "@/types/IState";

import { setPrimaryTool } from "./actions";
import reducer from "./reducers";

const defaults: ISettingsInterface = {
  language: "en",
  advanced: false,
  profilesVisible: true,
  desktopNotifications: false,
  hideTopLevelCategory: false,
  relativeTimes: true,
  alwaysCompactHeaders: false,
  showGameArt: true,
  dashboardLayout: [],
  foregroundDL: true,
  dashletSettings: {},
  usage: {},
};

describe("setPrimaryTool", () => {
  it("sets the Primary Tool", () => {
    const input = { ...defaults, primaryTool: { gameId1: "value" } };
    const result = reducer.reducers.SET_PRIMARY_TOOL(
      input,
      setPrimaryTool("gameId1", "new value").payload,
    );
    expect(result).toEqual({ ...defaults, primaryTool: { gameId1: "new value" } });
  });
  it("creates the new gameId and the related toolId if the game doesn't exist", () => {
    const input = { ...defaults, primaryTool: { gameId1: "value" } };
    const result = reducer.reducers.SET_PRIMARY_TOOL(
      input,
      setPrimaryTool("gameId2", "new value").payload,
    );
    expect(result).toEqual({
      ...defaults,
      primaryTool: { gameId1: "value", gameId2: "new value" },
    });
  });
  it("affects only the right game", () => {
    const input = { ...defaults, primaryTool: { gameId1: "value", gameId2: "value" } };
    const result = reducer.reducers.SET_PRIMARY_TOOL(
      input,
      setPrimaryTool("gameId2", "new value").payload,
    );
    expect(result).toEqual({
      ...defaults,
      primaryTool: { gameId1: "value", gameId2: "new value" },
    });
  });
});
