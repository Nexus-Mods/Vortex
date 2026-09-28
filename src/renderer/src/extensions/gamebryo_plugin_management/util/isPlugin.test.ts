import { describe, expect, it } from "vitest";

import { isPluginName } from "./isPlugin";

describe("isPluginName", () => {
  it("accepts the game's plugin extensions in any casing", () => {
    expect(isPluginName("Mod.esp", "skyrimse")).toBe(true);
    expect(isPluginName("Mod.ESM", "skyrimse")).toBe(true);
  });

  it("accepts a light plugin only where the game has them", () => {
    expect(isPluginName("Mod.esl", "skyrimse")).toBe(true);
    expect(isPluginName("Mod.esl", "skyrimvr")).toBe(false);
  });

  it("rejects other files, a ghosted name among them", () => {
    expect(isPluginName("readme.txt", "skyrimse")).toBe(false);
    expect(isPluginName("Mod.esp.ghost", "skyrimse")).toBe(false);
  });
});
