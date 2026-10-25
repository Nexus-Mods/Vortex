import { describe, expect, it } from "vitest";

import {
  APP_DISPLAY_NAME,
  APP_NAME,
  NEXUS_APP_NAME,
  NEXUS_APP_VERSION,
  TELEMETRY_ENABLED,
  UPDATER_ENABLED,
  USER_AGENT,
} from "./branding";

describe("branding", () => {
  // The Nexus Mods API Acceptable Use Policy forbids posing as another app.
  it("never identifies as Vortex to Nexus Mods", () => {
    for (const value of [APP_NAME, APP_DISPLAY_NAME, NEXUS_APP_NAME, USER_AGENT]) {
      expect(value.toLowerCase()).not.toContain("vortex");
    }
    expect(NEXUS_APP_NAME).toBe("mkeiitmods");
    expect(USER_AGENT).toBe(`mkeiitmods/${NEXUS_APP_VERSION}`);
  });

  it("ships with the updater and telemetry off", () => {
    expect(UPDATER_ENABLED).toBe(false);
    expect(TELEMETRY_ENABLED).toBe(false);
  });
});
