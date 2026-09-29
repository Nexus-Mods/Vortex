import { describe, expect, it } from "vitest";

import {
  CONTENT_MANAGER_MODS_SECTION,
  ContentManagerState,
  evaluateContentManagerSettings,
} from "./contentManager";
import { modFolderNameFromPath, modFolderNames } from "./modFolders";

const section = (values: Record<string, unknown>) => ({
  [CONTENT_MANAGER_MODS_SECTION]: values,
  Gameplay: { ModioEnabled: "true" },
});

describe("evaluateContentManagerSettings", () => {
  it("reports mods as loading when both switches are on", () => {
    expect(evaluateContentManagerSettings(section({ Enabled: "true", EnabledLocal: "true" }))).toBe(
      ContentManagerState.Ok,
    );
  });

  it("reports all mod loading off when the master switch is off", () => {
    expect(
      evaluateContentManagerSettings(section({ Enabled: "false", EnabledLocal: "true" })),
    ).toBe(ContentManagerState.ModsDisabled);
  });

  it("reports local mod loading off when only that switch is off", () => {
    expect(
      evaluateContentManagerSettings(section({ Enabled: "true", EnabledLocal: "false" })),
    ).toBe(ContentManagerState.LocalModsDisabled);
  });

  it("accepts the numeric form of the switches", () => {
    // The file is hand-editable, so 0/1 shows up in the wild.
    expect(evaluateContentManagerSettings(section({ Enabled: "1", EnabledLocal: "0" }))).toBe(
      ContentManagerState.LocalModsDisabled,
    );
    expect(evaluateContentManagerSettings(section({ Enabled: "0" }))).toBe(
      ContentManagerState.ModsDisabled,
    );
  });

  it("reports unknown when the section is absent", () => {
    // Most likely the game has never been run, which is not a fault.
    expect(evaluateContentManagerSettings({ Gameplay: {} })).toBe(ContentManagerState.Unknown);
    expect(evaluateContentManagerSettings(undefined)).toBe(ContentManagerState.Unknown);
  });

  it("treats a section with neither switch present as loading", () => {
    expect(evaluateContentManagerSettings(section({ MaxNameLength: "64" }))).toBe(
      ContentManagerState.Ok,
    );
  });
});

describe("modFolderNameFromPath", () => {
  it("takes the folder in front of the content directory", () => {
    expect(modFolderNameFromPath("modFoo\\content\\scripts\\x.ws")).toBe("modFoo");
    expect(modFolderNameFromPath("modFoo/content/scripts/x.ws")).toBe("modFoo");
  });

  it("matches the content directory regardless of case", () => {
    expect(modFolderNameFromPath("modFoo\\Content\\blob0.bundle")).toBe("modFoo");
  });

  it("ignores paths with no content directory", () => {
    expect(modFolderNameFromPath("modFoo\\scripts\\x.ws")).toBeUndefined();
  });

  it("ignores a content directory at the root", () => {
    // Nothing in front of it to name the mod after.
    expect(modFolderNameFromPath("content\\scripts\\x.ws")).toBeUndefined();
  });
});

describe("modFolderNames", () => {
  it("collects each folder once", () => {
    expect(
      modFolderNames([
        "modFoo\\content\\a.ws",
        "modFoo\\content\\b.ws",
        "modBar\\content\\c.ws",
        "readme.txt",
      ]),
    ).toEqual(["modFoo", "modBar"]);
  });
});
