import path from "node:path";

import { describe, expect, it } from "vitest";

import { isMergerToolValidForRoot, isPathWithinRoot, mergerDirForRoot } from "./mergerPaths";

// Built with the host's separators, as the paths Vortex passes in are.
const FS_ROOT = path.parse(process.cwd()).root;
const GOG = path.join(FS_ROOT, "Games", "GOG Galaxy", "Games", "The Witcher 3 Wild Hunt GOTY");
const STEAM = path.join(
  FS_ROOT,
  "Program Files (x86)",
  "Steam",
  "steamapps",
  "common",
  "The Witcher 3",
);
const MERGER_EXE = path.join("WitcherScriptMerger", "WitcherScriptMerger.exe");

describe("isMergerToolValidForRoot", () => {
  it("accepts a merger installed under the discovered game root", () => {
    expect(isMergerToolValidForRoot(path.join(STEAM, MERGER_EXE), STEAM)).toBe(true);
  });

  it("rejects a merger belonging to the other install", () => {
    // Both editions are managed under one game entry, and the other install is
    // still on disk, so the stale path stats fine.
    expect(isMergerToolValidForRoot(path.join(GOG, MERGER_EXE), STEAM)).toBe(false);
  });

  it("ignores case and trailing separators", () => {
    const tool = path.join(STEAM.toUpperCase(), MERGER_EXE.toLowerCase());
    expect(isMergerToolValidForRoot(tool, STEAM + path.sep)).toBe(true);
  });

  it("does not treat a sibling directory with a shared prefix as inside the root", () => {
    expect(isPathWithinRoot(path.join(`${STEAM} Remastered`, "x.exe"), STEAM)).toBe(false);
  });

  it("treats the root itself as within the root", () => {
    expect(isPathWithinRoot(STEAM, STEAM)).toBe(true);
  });

  it("rejects an undefined path or root", () => {
    expect(isMergerToolValidForRoot(undefined, STEAM)).toBe(false);
    expect(isMergerToolValidForRoot(path.join(STEAM, "x.exe"), undefined)).toBe(false);
  });
});

describe("mergerDirForRoot", () => {
  it("places the merger inside the game root", () => {
    expect(mergerDirForRoot(STEAM)).toBe(path.join(STEAM, "WitcherScriptMerger"));
  });
});
