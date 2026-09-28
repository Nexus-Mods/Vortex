import { describe, expect, it } from "vitest";

import { isMergerToolValidForRoot, isPathWithinRoot, mergerDirForRoot } from "./mergerPaths";

const GOG = "C:\\Games\\GOG Galaxy\\Games\\The Witcher 3 Wild Hunt GOTY";
const STEAM = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\The Witcher 3";

describe("isMergerToolValidForRoot", () => {
  it("accepts a merger installed under the discovered game root", () => {
    const tool = `${STEAM}\\WitcherScriptMerger\\WitcherScriptMerger.exe`;
    expect(isMergerToolValidForRoot(tool, STEAM)).toBe(true);
  });

  it("rejects a merger belonging to the other install", () => {
    // Both editions are managed under one game entry, and the other install is
    // still on disk, so the stale path stats fine.
    const tool = `${GOG}\\WitcherScriptMerger\\WitcherScriptMerger.exe`;
    expect(isMergerToolValidForRoot(tool, STEAM)).toBe(false);
  });

  it("ignores case and trailing separators", () => {
    const tool = `${STEAM.toUpperCase()}\\witcherscriptmerger\\WitcherScriptMerger.exe`;
    expect(isMergerToolValidForRoot(tool, `${STEAM}\\`)).toBe(true);
  });

  it("does not treat a sibling directory with a shared prefix as inside the root", () => {
    expect(isPathWithinRoot(`${STEAM} Remastered\\x.exe`, STEAM)).toBe(false);
  });

  it("treats the root itself as within the root", () => {
    expect(isPathWithinRoot(STEAM, STEAM)).toBe(true);
  });

  it("rejects an undefined path or root", () => {
    expect(isMergerToolValidForRoot(undefined, STEAM)).toBe(false);
    expect(isMergerToolValidForRoot(`${STEAM}\\x.exe`, undefined)).toBe(false);
  });
});

describe("mergerDirForRoot", () => {
  it("places the merger inside the game root", () => {
    expect(mergerDirForRoot(STEAM)).toBe(`${STEAM}\\WitcherScriptMerger`);
  });
});
