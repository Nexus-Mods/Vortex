import { GameDomain } from "@vortex/shared";
import { describe, expect, it } from "vitest";

import { nexusFilePageUrl, nexusModFilesUrl, nexusModPageUrl } from "./nexusUrls";

const SKYRIM = GameDomain("skyrimspecialedition");

describe("nexusModPageUrl", () => {
  it("is the mod's page", () => {
    expect(nexusModPageUrl(SKYRIM, 12604)).toBe(
      "https://www.nexusmods.com/skyrimspecialedition/mods/12604",
    );
  });
});

describe("nexusFilePageUrl", () => {
  it("is the file on its mod's Files tab, offered to Vortex", () => {
    expect(nexusFilePageUrl(SKYRIM, 12604, "42")).toBe(
      "https://www.nexusmods.com/skyrimspecialedition/mods/12604?tab=files&file_id=42&nmm=1",
    );
  });
});

describe("nexusModFilesUrl", () => {
  it("is the mod's Files tab", () => {
    expect(nexusModFilesUrl(SKYRIM, 12604)).toBe(
      "https://www.nexusmods.com/skyrimspecialedition/mods/12604?tab=files",
    );
  });
});
