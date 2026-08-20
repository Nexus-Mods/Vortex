import { describe, expect, it } from "vitest";

import { allowedTypesFor } from "./allowedTypes";

describe("fomod ipc allowedTypesFor", () => {
  describe("while the native addon loads", () => {
    const native = true;

    it("claims C# for the games that ship C# fomods", () => {
      expect(allowedTypesFor("fallout3", undefined, "scripted", native)).toEqual(["CSharpScript"]);
    });

    it("claims nothing for other games, leaving them to the native installer", () => {
      expect(allowedTypesFor("fallout4", undefined, "scripted", native)).toEqual([]);
    });

    it("claims nothing when the archive is known to have no C# script", () => {
      expect(allowedTypesFor("fallout3", { hasCSScripts: false }, "scripted", native)).toEqual([]);
    });

    it("stays out of basic installs entirely", () => {
      expect(allowedTypesFor("fallout4", undefined, "basic", native)).toEqual([]);
    });
  });

  describe("when the native addon is unavailable", () => {
    // Without this the mod reaches mod_management's verbatim-copy `fallback`
    // installer, which applies neither stop patterns nor pluginPath - that is
    // what nests a Bethesda archive's `Data` inside the game's own `Data`.
    const native = false;

    it("takes over XmlScript for a game the native installer used to own", () => {
      expect(allowedTypesFor("fallout4", undefined, "scripted", native)).toEqual(["XmlScript"]);
    });

    it("takes over basic installs", () => {
      expect(allowedTypesFor("fallout4", undefined, "basic", native)).toEqual(["Basic"]);
    });

    it("still claims both types on a C# game", () => {
      expect(allowedTypesFor("oblivion", undefined, "scripted", native)).toEqual([
        "CSharpScript",
        "XmlScript",
      ]);
    });

    it("respects the archive scan that ruled out an XmlScript config", () => {
      expect(allowedTypesFor("fallout4", { hasXmlConfigXML: false }, "scripted", native)).toEqual(
        [],
      );
    });
  });
});
