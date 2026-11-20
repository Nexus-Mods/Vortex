import { mkdir } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { seedPluginDir } from "../../../test-utils/gamebryoTest";
import { makeTempDir } from "../../../test-utils/tempDir";
import { isPluginName, selectPluginFiles, selectStagedPlugins } from "./isPlugin";

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

describe("selectPluginFiles", () => {
  it("keeps plugin files, ghosted ones included, in their listed order", async () => {
    const names = ["One.esp", "readme.txt", "Two.esm.ghost"];
    const dir = await seedPluginDir(await makeTempDir("vortex-isplugin-"), names);

    expect(await selectPluginFiles(dir, names, "skyrimse")).toEqual(["One.esp", "Two.esm.ghost"]);
  });

  it("drops a folder named like a plugin", async () => {
    const dir = await makeTempDir("vortex-isplugin-");
    await mkdir(path.join(dir, "Folder.esp"));

    expect(await selectPluginFiles(dir, ["Folder.esp"], "skyrimse")).toEqual([]);
  });

  // a file can be deleted between the directory listing and the check
  it("drops a listed plugin that is no longer on disk", async () => {
    const dir = await seedPluginDir(await makeTempDir("vortex-isplugin-"), ["One.esp"]);

    expect(await selectPluginFiles(dir, ["One.esp", "Gone.esp"], "skyrimse")).toEqual(["One.esp"]);
  });
});

describe("selectStagedPlugins", () => {
  const LNK = ".vortex_lnk";
  // how move deployment names the file a placeholder stands for
  const deployedName = (fileName: string) =>
    fileName.endsWith(LNK) ? fileName.slice(0, -LNK.length) : fileName;

  it("tells the plugins in the folder from the ones only a placeholder stands for", async () => {
    const names = ["Staged.esp", `Moved.esp${LNK}`, `texture.dds${LNK}`];
    const dir = await seedPluginDir(await makeTempDir("vortex-isplugin-"), names);

    const plugins = await selectStagedPlugins(dir, names, "skyrimse", deployedName);

    expect(plugins).toEqual({ staged: ["Staged.esp"], movedOut: ["Moved.esp"] });
  });
});
