import { describe, expect, it } from "vitest";

import { rebrandText } from "./rebrand";

describe("rebrandText", () => {
  it.each([
    ["Vortex failed to start up", "mkeiitmods failed to start up"],
    ["Restart Vortex now?", "Restart mkeiitmods now?"],
    ["Please restart Vortex.", "Please restart mkeiitmods."],
    ["Vortex's settings", "mkeiitmods's settings"],
    [
      "Vortex will now handle Nexus Download links",
      "mkeiitmods will now handle Nexus Download links",
    ],
    ["Vortex (dev build)", "mkeiitmods (dev build)"],
    ["Vortex, Steam and GOG", "mkeiitmods, Steam and GOG"],
  ])("renames %j", (input, expected) => {
    expect(rebrandText(input)).toBe(expected);
  });

  it.each([
    "mkeiitmods is based on Vortex (Nexus Mods)",
    "mkeiitmods основан на Vortex",
    "See the Vortex Wiki for details",
    "https://github.com/Nexus-Mods/Vortex/issues",
    "C:\\Program Files\\Black Tree Gaming Ltd\\Vortex\\Vortex.exe",
    "install the vortex-api package",
    "@vortex/main",
    "VortexGameId",
  ])("keeps upstream references in %j", (input) => {
    expect(rebrandText(input)).toBe(input);
  });

  it("leaves text without the name alone", () => {
    expect(rebrandText("Install mods")).toBe("Install mods");
    expect(rebrandText("")).toBe("");
  });
});
