import { describe, expect, it } from "vitest";

import { filePageUrl, nexusModPageUrl } from "./filePageUrl";

describe("filePageUrl", () => {
  it("opens the files tab on the specific file", () => {
    expect(filePageUrl("https://www.nexusmods.com/stardewvalley/mods/21", 123)).toBe(
      "https://www.nexusmods.com/stardewvalley/mods/21?tab=files&file_id=123&nmm=1",
    );
  });
});

describe("nexusModPageUrl", () => {
  it("builds the mod page from the game domain and mod id", () => {
    expect(nexusModPageUrl("stardewvalley", 21)).toBe(
      "https://www.nexusmods.com/stardewvalley/mods/21",
    );
  });
});
