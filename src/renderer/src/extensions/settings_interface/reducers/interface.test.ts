import { VortexGameId } from "@vortex/shared";
import { describe, it, expect } from "vitest";

import type { ISettingsInterface } from "@/types/IState";

import * as actions from "../actions/interface";
import settingsReducer from "./interface";

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

describe("setLanguage", () => {
  it("sets the Language", () => {
    const input = { ...defaults, language: "" };
    const result = settingsReducer.reducers.SET_USER_LANGUAGE(
      input,
      actions.setLanguage("English").payload,
    );
    expect(result).toEqual({ ...defaults, language: "English" });
  });
});

describe("setAdvancedMode", () => {
  it("sets the Advanced Mode", () => {
    const input = { ...defaults, advanced: false };
    const result = settingsReducer.reducers.SET_ADVANCED_MODE(
      input,
      actions.setAdvancedMode(true).payload,
    );
    expect(result).toEqual({ ...defaults, advanced: true });
  });
});

describe("setProfilesVisible", () => {
  it("sets the Profile Visible", () => {
    const input = { ...defaults, profilesVisible: false };
    const result = settingsReducer.reducers.SET_PROFILES_VISIBLE(
      input,
      actions.setProfilesVisible(true).payload,
    );
    expect(result).toEqual({ ...defaults, profilesVisible: true });
  });
});

describe("showUsageInstruction", () => {
  it("sets one usage instruction and leaves the others", () => {
    const input = { ...defaults, usage: { other: true } };
    const result = settingsReducer.reducers.SHOW_USAGE_INSTRUCTION(
      input,
      actions.showUsageInstruction("mine", false).payload,
    );
    expect(result).toEqual({ ...defaults, usage: { other: true, mine: false } });
  });

  it("keeps the same state when the instruction already has that value", () => {
    const input = { ...defaults, usage: { mine: false } };
    const result = settingsReducer.reducers.SHOW_USAGE_INSTRUCTION(
      input,
      actions.showUsageInstruction("mine", false).payload,
    );
    expect(result).toBe(input);
  });

  it("creates usage when it is missing", () => {
    const input = { ...defaults, usage: undefined };
    const result = settingsReducer.reducers.SHOW_USAGE_INSTRUCTION(
      input,
      actions.showUsageInstruction("mine", true).payload,
    );
    expect(result.usage).toEqual({ mine: true });
  });
});

describe("setAlwaysCompactHeaders", () => {
  it("sets the always compact headers preference", () => {
    const input = { ...defaults, alwaysCompactHeaders: false };
    const result = settingsReducer.reducers.SET_ALWAYS_COMPACT_HEADERS(
      input,
      actions.setAlwaysCompactHeaders(true).payload,
    );
    expect(result).toEqual({ ...defaults, alwaysCompactHeaders: true });
  });
});

describe("setShowGameArt", () => {
  it("sets the game art preference", () => {
    const result = settingsReducer.reducers.SET_SHOW_GAME_ART(
      { ...defaults, showGameArt: true },
      actions.setShowGameArt(false).payload,
    );
    expect(result).toEqual({ ...defaults, showGameArt: false });
  });

  it("shows game art by default", () => {
    expect(settingsReducer.defaults.showGameArt).toBe(true);
  });
});

describe("setReduceMotion", () => {
  it("records the choice", () => {
    const result = settingsReducer.reducers.SET_REDUCE_MOTION(
      defaults,
      actions.setReduceMotion(true).payload,
    );
    expect(result).toEqual({ ...defaults, reduceMotion: true });
  });

  // Unset means "follow the OS", so an explicit false has to be stored as false rather
  // than left absent.
  it("records turning it back off", () => {
    const result = settingsReducer.reducers.SET_REDUCE_MOTION(
      { ...defaults, reduceMotion: true },
      actions.setReduceMotion(false).payload,
    );
    expect(result).toEqual({ ...defaults, reduceMotion: false });
  });

  it("has no default, so an untouched setting follows the OS", () => {
    expect(settingsReducer.defaults).not.toHaveProperty("reduceMotion");
  });
});

describe("setLastPage", () => {
  it("remembers Home's page and each game's apart", () => {
    let state = settingsReducer.reducers.SET_LAST_PAGE(
      defaults,
      actions.setLastPage({ pageId: "Dashboard" }).payload,
    );
    state = settingsReducer.reducers.SET_LAST_PAGE(
      state,
      actions.setLastPage({ pageId: "Mods", gameId: VortexGameId("skyrim") }).payload,
    );
    state = settingsReducer.reducers.SET_LAST_PAGE(
      state,
      actions.setLastPage({ pageId: "health", gameId: VortexGameId("stardew") }).payload,
    );

    expect(state.lastPages).toEqual({
      home: "Dashboard",
      games: { [VortexGameId("skyrim")]: "Mods", [VortexGameId("stardew")]: "health" },
    });
  });
});

describe("setLastPage when the page is already remembered", () => {
  it("returns the same state, so nothing re-renders or is written", () => {
    const state = settingsReducer.reducers.SET_LAST_PAGE(
      defaults,
      actions.setLastPage({ pageId: "Mods", gameId: VortexGameId("skyrim") }).payload,
    );

    expect(
      settingsReducer.reducers.SET_LAST_PAGE(
        state,
        actions.setLastPage({ pageId: "Mods", gameId: VortexGameId("skyrim") }).payload,
      ),
    ).toBe(state);
  });
});
