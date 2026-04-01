import { describe, it, expect } from "vitest";

import * as interfaceActions from "./interface";

describe("setLanguage", () => {
  it("creates the correct action", () => {
    expect(interfaceActions.setLanguage("English")).toEqual({
      error: false,
      type: "SET_USER_LANGUAGE",
      payload: "English",
    });
  });
});

describe("setAdvancedMode", () => {
  it("creates the correct action", () => {
    expect(interfaceActions.setAdvancedMode(true)).toEqual({
      error: false,
      type: "SET_ADVANCED_MODE",
      payload: { advanced: true },
    });
  });
});

describe("setProfilesVisible", () => {
  it("creates the correct action", () => {
    expect(interfaceActions.setProfilesVisible(true)).toEqual({
      error: false,
      type: "SET_PROFILES_VISIBLE",
      payload: { visible: true },
    });
  });
});
