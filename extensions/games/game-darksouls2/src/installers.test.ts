import path from "node:path";

import type { types } from "@nexusmods/vortex-api";
import { describe, expect, it } from "vitest";

import {
  DARKSOULS2_GAME_ID,
  DARKSOULS2_PRIORITIES,
  PROXY_DLLS,
  allTextures,
  installGameDir,
  installTextures,
  testGameDir,
  testTextures,
} from "./installers";

const SEP = path.sep;
const g = (...segments: string[]): string => path.join("Game", ...segments);
const tex = (name: string): string => path.join("Game", "tex_override", name);

function copies(instructions: types.IInstruction[]): types.IInstruction[] {
  return instructions.filter((inst) => inst.type === "copy");
}

function lastInstruction(instructions: types.IInstruction[]): types.IInstruction | undefined {
  return instructions[instructions.length - 1];
}

describe("priorities", () => {
  it("puts both installers ahead of modtype-dinput and modtype-gedosato (50)", () => {
    expect(DARKSOULS2_PRIORITIES.gameDir).toBeLessThan(50);
    expect(DARKSOULS2_PRIORITIES.textures).toBeLessThan(50);
  });

  it("runs the injector before the texture installer", () => {
    expect(DARKSOULS2_PRIORITIES.gameDir).toBeLessThan(DARKSOULS2_PRIORITIES.textures);
  });

  it("leaves the slots the planned savegame and content installers need", () => {
    const taken: number[] = Object.values(DARKSOULS2_PRIORITIES);
    expect(taken).not.toContain(20);
    expect(taken).not.toContain(30);
  });
});

describe("testGameDir", () => {
  it.each(PROXY_DLLS)("claims an archive containing %s", async (dll) => {
    const result = await testGameDir([dll, "readme.txt"], DARKSOULS2_GAME_ID);
    expect(result.supported).toBe(true);
    expect(result.requiredFiles).toEqual([dll]);
  });

  it("matches the DLL name case-insensitively", async () => {
    const result = await testGameDir(["DXGI.DLL"], DARKSOULS2_GAME_ID);
    expect(result.supported).toBe(true);
  });

  it("finds the injector inside a wrapper directory", async () => {
    const result = await testGameDir(
      [path.join("DS2LE", "dxgi.dll"), path.join("DS2LE", "shader", "a.fx")],
      DARKSOULS2_GAME_ID,
    );
    expect(result.supported).toBe(true);
  });

  it("declines when dinput8.dll is present, leaving ModEngine to modtype-dinput", async () => {
    const result = await testGameDir(["dxgi.dll", "dinput8.dll"], DARKSOULS2_GAME_ID);
    expect(result).toEqual({ supported: false, requiredFiles: [] });
  });

  it("declines when dinput8.dll is nested rather than at the root", async () => {
    const result = await testGameDir(
      ["dxgi.dll", path.join("SeekerOfFire_2", "dinput8.dll")],
      DARKSOULS2_GAME_ID,
    );
    expect(result.supported).toBe(false);
  });

  it("declines archives with no proxy DLL", async () => {
    const result = await testGameDir(
      [path.join("Param", "x.param"), "readme.txt"],
      DARKSOULS2_GAME_ID,
    );
    expect(result).toEqual({ supported: false, requiredFiles: [] });
  });

  it("declines another game", async () => {
    const result = await testGameDir(["dxgi.dll"], "sekiro");
    expect(result).toEqual({ supported: false, requiredFiles: [] });
  });

  it("ignores a directory entry that happens to be named like a proxy DLL", async () => {
    const result = await testGameDir(["dxgi.dll" + SEP], DARKSOULS2_GAME_ID);
    expect(result.supported).toBe(false);
  });
});

describe("installGameDir", () => {
  it("prefixes a root-level archive with Game/", async () => {
    const { instructions } = await installGameDir([
      "dxgi.dll",
      path.join("shader", "a.fx"),
      path.join("tex_override", "x.dds"),
    ]);
    expect(copies(instructions)).toEqual([
      { type: "copy", source: "dxgi.dll", destination: g("dxgi.dll") },
      { type: "copy", source: path.join("shader", "a.fx"), destination: g("shader", "a.fx") },
      {
        type: "copy",
        source: path.join("tex_override", "x.dds"),
        destination: g("tex_override", "x.dds"),
      },
    ]);
  });

  it("strips the wrapper directory the injector sits in", async () => {
    const { instructions } = await installGameDir([
      path.join("DS2LE", "dxgi.dll"),
      path.join("DS2LE", "tex_override", "x.dds"),
    ]);
    expect(copies(instructions)).toEqual([
      { type: "copy", source: path.join("DS2LE", "dxgi.dll"), destination: g("dxgi.dll") },
      {
        type: "copy",
        source: path.join("DS2LE", "tex_override", "x.dds"),
        destination: g("tex_override", "x.dds"),
      },
    ]);
  });

  it("drops files outside the injector's directory", async () => {
    const { instructions } = await installGameDir([
      path.join("DS2LE", "dxgi.dll"),
      "README.txt",
      path.join("screenshots", "a.png"),
    ]);
    expect(copies(instructions)).toEqual([
      { type: "copy", source: path.join("DS2LE", "dxgi.dll"), destination: g("dxgi.dll") },
    ]);
  });

  it("drops directory entries", async () => {
    const { instructions } = await installGameDir(["dxgi.dll", "shader" + SEP]);
    expect(copies(instructions)).toHaveLength(1);
  });

  it("pins the mod to the default modType", async () => {
    const { instructions } = await installGameDir(["dxgi.dll"]);
    expect(lastInstruction(instructions)).toEqual({ type: "setmodtype", value: "" });
  });
});

describe("allTextures", () => {
  it("accepts .dds and .png, and directory entries", () => {
    expect(allTextures(["a.dds", "b.PNG", "sub" + SEP])).toBe(true);
  });

  it("rejects anything else", () => {
    expect(allTextures(["a.dds", "readme.txt"])).toBe(false);
  });
});

describe("testTextures", () => {
  it("claims a bare texture archive when GeDoSaTo is absent", async () => {
    const result = await testTextures(["a.dds", "b.png"], DARKSOULS2_GAME_ID, false);
    expect(result.supported).toBe(true);
  });

  it("claims a tex_override-rooted archive", async () => {
    const result = await testTextures(
      [path.join("tex_override", "a.dds")],
      DARKSOULS2_GAME_ID,
      false,
    );
    expect(result.supported).toBe(true);
  });

  it("stands down when GeDoSaTo is installed, preserving the current behaviour", async () => {
    const result = await testTextures(["a.dds"], DARKSOULS2_GAME_ID, true);
    expect(result).toEqual({ supported: false, requiredFiles: [] });
  });

  it("declines when any non-texture file is present", async () => {
    const result = await testTextures(["a.dds", "readme.txt"], DARKSOULS2_GAME_ID, false);
    expect(result.supported).toBe(false);
  });

  it("declines an archive of only directory entries", async () => {
    const result = await testTextures(["tex_override" + SEP], DARKSOULS2_GAME_ID, false);
    expect(result.supported).toBe(false);
  });

  it("declines an empty archive", async () => {
    const result = await testTextures([], DARKSOULS2_GAME_ID, false);
    expect(result.supported).toBe(false);
  });

  it("declines another game", async () => {
    const result = await testTextures(["a.dds"], "sekiro", false);
    expect(result.supported).toBe(false);
  });
});

describe("installTextures", () => {
  it("flattens loose textures into Game/tex_override/", async () => {
    const { instructions } = await installTextures(["a.dds", "b.png"]);
    expect(copies(instructions)).toEqual([
      { type: "copy", source: "a.dds", destination: tex("a.dds") },
      { type: "copy", source: "b.png", destination: tex("b.png") },
    ]);
  });

  it("flattens an archive already rooted at tex_override", async () => {
    const { instructions } = await installTextures([path.join("tex_override", "a.dds")]);
    expect(copies(instructions)).toEqual([
      {
        type: "copy",
        source: path.join("tex_override", "a.dds"),
        destination: tex("a.dds"),
      },
    ]);
  });

  it("flattens arbitrarily deep nesting", async () => {
    const { instructions } = await installTextures([path.join("sub", "deep", "a.dds")]);
    expect(copies(instructions)[0]).toEqual({
      type: "copy",
      source: path.join("sub", "deep", "a.dds"),
      destination: tex("a.dds"),
    });
  });

  it("drops directory entries", async () => {
    const { instructions } = await installTextures(["a.dds", "sub" + SEP]);
    expect(copies(instructions)).toHaveLength(1);
  });

  it("still installs when flattening collides, rather than failing", async () => {
    const { instructions } = await installTextures([
      path.join("one", "a.dds"),
      path.join("two", "a.dds"),
    ]);
    expect(copies(instructions)).toHaveLength(2);
  });

  it("pins the mod to the default modType", async () => {
    const { instructions } = await installTextures(["a.dds"]);
    expect(lastInstruction(instructions)).toEqual({ type: "setmodtype", value: "" });
  });
});
