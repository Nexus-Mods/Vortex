import * as nodeFs from "node:fs";
import * as path from "node:path";

import { expect } from "vitest";

import { test } from "../../test-utils/deploymentTest";
import type { Normalize } from "../../util/getNormalizeFunc";

const MOD = "SomeMod";
const FILES = { "ModInfo.xml": "<xml/>", [path.join("Config", "test.xml")]: "<config/>" };

// mods merged into the game folder, or each in its own folder (mergeMods off)
const PLACEMENTS = [
  { placement: "merged into the game folder", modFolders: false },
  { placement: "in its own folder", modFolders: true },
];

// Windows drives compare paths upper-cased, case-sensitive ones as they are
const DRIVES: Array<{ drive: string; normalize: Normalize }> = [
  { drive: "case-insensitive", normalize: (input) => input.toUpperCase() },
  { drive: "case-sensitive", normalize: (input) => input },
];

const CASES = PLACEMENTS.flatMap((placement) =>
  DRIVES.map((drive) => ({ ...placement, ...drive })),
);

test.for(CASES)(
  "a move redeploy of a mod $placement on a $drive drive records each file under its own name",
  async ({ modFolders, normalize }, { makeDeployment }) => {
    const h = makeDeployment({ files: FILES, method: "move", modName: MOD, modFolders, normalize });
    // the first deploy leaves a placeholder in staging for every file it moved
    await h.deploy();

    // without a previous manifest every placeholder counts as a new file
    const deployment = await h.deploy([]);

    expect(deployment.map((file) => file.relPath).sort()).toEqual(Object.keys(FILES).sort());
  },
);

test.for(CASES)(
  "removing a mod deployed by move $placement on a $drive drive moves its files back",
  async ({ modFolders, normalize }, { makeDeployment }) => {
    const h = makeDeployment({ files: FILES, method: "move", modName: MOD, modFolders, normalize });
    const deployment = await h.deploy();

    const remaining = await h.remove(deployment);

    expect(remaining).toEqual([]);
    expect(h.deployedFiles()).toEqual([]);
    expect(nodeFs.readFileSync(path.join(h.modDir(MOD), "ModInfo.xml"), "utf8")).toBe("<xml/>");
  },
);
