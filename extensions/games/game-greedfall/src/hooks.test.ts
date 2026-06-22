import { describe, it, expect } from "vitest";

import { installGreedfallMod } from "./hooks";

type Inst = { type: string; source?: string; destination?: string };

// Destinations are joined with the platform separator (path.sep), matching the
// original extension. Normalise to `/` so assertions hold on every platform.
const norm = (insts: Inst[]): Inst[] =>
  insts.map((i) => ({
    ...i,
    ...(i.destination !== undefined && { destination: i.destination.replace(/\\/g, "/") }),
  }));

describe("installGreedfallMod", () => {
  it("re-roots a datalocal-wrapped mod at the datalocal segment", async () => {
    const result = await installGreedfallMod(
      ["datalocal/Mods/cool.spk", "datalocal/Mods/data.bin"],
      "/staging/x",
    );
    expect(norm(result.instructions as Inst[])).toEqual([
      { type: "copy", source: "datalocal/Mods/cool.spk", destination: "Mods/cool.spk" },
      { type: "copy", source: "datalocal/Mods/data.bin", destination: "Mods/data.bin" },
    ]);
  });

  it("matches the datalocal segment case-insensitively and drops everything up to it", async () => {
    const result = await installGreedfallMod(["Wrapper/DataLocal/Mods/cool.spk"], "/staging/x");
    expect(norm(result.instructions as Inst[])).toEqual([
      { type: "copy", source: "Wrapper/DataLocal/Mods/cool.spk", destination: "Mods/cool.spk" },
    ]);
  });

  it("passes through an unwrapped mod (no datalocal segment) unchanged", async () => {
    const result = await installGreedfallMod(["Mods/cool.spk", "readme.txt"], "/staging/x");
    expect(norm(result.instructions as Inst[])).toEqual([
      { type: "copy", source: "Mods/cool.spk", destination: "Mods/cool.spk" },
      { type: "copy", source: "readme.txt", destination: "readme.txt" },
    ]);
  });

  it("turns directory entries into mkdir instructions, re-rooted like files", async () => {
    const result = await installGreedfallMod(
      ["datalocal/Mods/cool.spk", "LooseDir/"],
      "/staging/x",
    );
    const insts = norm(result.instructions as Inst[]);
    expect(insts[0]).toEqual({
      type: "copy",
      source: "datalocal/Mods/cool.spk",
      destination: "Mods/cool.spk",
    });
    // A directory entry becomes a mkdir; an unwrapped dir keeps its path.
    expect(insts[1]?.type).toBe("mkdir");
    expect(insts[1]?.destination).toBe("LooseDir/");
  });

  // FOMOD archives (fomod/moduleconfig.xml) are excluded by the installer's
  // `unless` predicate in game.yaml, so they never reach this hook. The hook
  // itself does no FOMOD filtering, which this test documents: a FOMOD-looking
  // file is copied through like any other entry.
  it("does not filter FOMOD itself (exclusion lives in the installer `unless`)", async () => {
    const result = await installGreedfallMod(["fomod/moduleconfig.xml"], "/staging/x");
    expect(result.instructions as Inst[]).toEqual([
      { type: "copy", source: "fomod/moduleconfig.xml", destination: "fomod/moduleconfig.xml" },
    ]);
  });
});
