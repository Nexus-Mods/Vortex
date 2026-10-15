import * as nodeFs from "node:fs";

import { VortexModStagingFolder } from "@vortex/shared";
import { expect } from "vitest";

import { makeMod } from "../../../test-utils/builders";
import { test, type IDeploymentHarness } from "../../../test-utils/deploymentTest";
import type { IDeployedFile } from "../types/IDeploymentMethod";
import { activateSingleMod, laterStagingFolders } from "./deploy";

const PLUGIN = "NVSE/Plugins/VATSLagFix.dll";
const REDEPLOYED = "Redeployed";

async function redeploy(
  h: IDeploymentHarness,
  lastActivation: IDeployedFile[],
  options: { fileOverrides?: string[]; laterSources?: string[] } = {},
): Promise<void> {
  await activateSingleMod({
    method: h.method,
    game: h.game,
    dataPath: h.gameDir,
    normalize: h.normalize,
    lastActivation,
    mod: makeMod({
      id: REDEPLOYED,
      installationPath: REDEPLOYED,
      fileOverrides: options.fileOverrides,
    }),
    modPath: h.modDir(REDEPLOYED),
    subDir: "",
    laterSources: new Set(
      (options.laterSources ?? []).map((folder) => VortexModStagingFolder(folder)),
    ),
  });
  await h.method.finalize("skyrimse", h.gameDir, h.stagingDir);
}

const deployedContent = (h: IDeploymentHarness) => nodeFs.readFileSync(h.inGame(PLUGIN), "utf8");

test("a mod sorted after the redeployed mod keeps its file", async ({ makeDeployment }) => {
  const h = makeDeployment({
    modName: REDEPLOYED,
    files: { [PLUGIN]: "redeployed" },
    otherMods: { Later: { [PLUGIN]: "later" } },
  });
  const lastActivation = await h.deployMod("Later");

  await redeploy(h, lastActivation, { laterSources: ["Later"] });

  expect(deployedContent(h)).toBe("later");
});

test("a file override keeps the redeployed mod's copy out of the game folder", async ({
  makeDeployment,
}) => {
  const h = makeDeployment({
    modName: REDEPLOYED,
    files: { [PLUGIN]: "redeployed" },
    otherMods: { Earlier: { [PLUGIN]: "earlier" } },
  });
  const lastActivation = await h.deployMod("Earlier");

  await redeploy(h, lastActivation, { fileOverrides: [h.inGame(PLUGIN)] });

  expect(deployedContent(h)).toBe("earlier");
});

test("the later staging folders are the mods sorted after the mod and its type's merged output", () => {
  const sorted = ["Earlier", "Redeployed", "Later", "Last"].map((id) =>
    makeMod({ id, installationPath: id, type: "enb" }),
  );

  const later = laterStagingFolders(sorted, sorted[1]);

  expect([...later]).toEqual(["Later", "Last", "__merged.enb"]);
});

test("a mod sorted before the redeployed mod loses the file to it", async ({ makeDeployment }) => {
  const h = makeDeployment({
    modName: REDEPLOYED,
    files: { [PLUGIN]: "redeployed" },
    otherMods: { Earlier: { [PLUGIN]: "earlier" } },
  });
  const lastActivation = await h.deployMod("Earlier");

  await redeploy(h, lastActivation);

  expect(deployedContent(h)).toBe("redeployed");
});
