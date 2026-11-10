import * as nodeFs from "node:fs";

import { expect } from "vitest";

import { makeDeployedFile } from "../../test-utils/builders";
import { test } from "../../test-utils/deploymentTest";
import { writeInto } from "../../test-utils/tempDir";
import { BACKUP_TAG, type IDeployment } from "./LinkingDeployment";
import type { IDeployedFile, IDeploymentMethod } from "./types/IDeploymentMethod";
import { deployedFilePath } from "./util/deployedFilePath";

/** The private members of LinkingActivator this exercises directly. */
interface ILinkingInternals {
  context: { previousDeployment: IDeployment };
  unlinkChanged: (
    keys: string[],
    installationPath: string,
    dataPath: string,
    onError: (file: IDeployedFile | undefined, err: unknown) => void,
  ) => Promise<string[]>;
}

const internals = (method: IDeploymentMethod): ILinkingInternals =>
  method as unknown as ILinkingInternals;

const FILES = {
  "CrashLogger.ini": "[Debug]",
  "BugFixesSSE.log": "log line",
  "po3_Tweaks.ini": "[General]",
  "ActorLimitFix.log": "log line",
  "SkyUI_SE.esp": "esp data",
};

test("reports a file deleted from staging for each mod that deploys it into its subfolder", async ({
  makeDeployment,
}) => {
  const h = makeDeployment({ files: {} });
  const deployed = ["AAA-mod-a", "AAB-mod-b"].map((target) =>
    makeDeployedFile({ relPath: "ModInfo.xml", source: target, target }),
  );
  for (const file of deployed) {
    await writeInto(deployedFilePath(h.gameDir, file.target, ""), file.relPath);
  }

  const changes = await h.method.externalChanges("skyrimse", h.stagingDir, h.gameDir, deployed);

  const reported = changes
    .map((change) => [change.changeType, change.target])
    .sort(([, lhs], [, rhs]) => lhs.localeCompare(rhs));
  expect(reported).toEqual([
    ["srcdeleted", "AAA-mod-a"],
    ["srcdeleted", "AAB-mod-b"],
  ]);
});

test("keeps every file whose unlink succeeded in the re-link list", async ({ makeDeployment }) => {
  const h = makeDeployment({ files: FILES });
  await h.method.prepare(h.gameDir, false, h.manifest(), h.normalize);

  const activator = internals(h.method);
  const keys: string[] = Object.keys(activator.context.previousDeployment);

  // removeDeployedFile rejects for a key with no previous deployment; the rest unlink
  // nothing, which counts as success
  const failing = [keys[1], keys[3]];
  for (const key of failing) {
    delete activator.context.previousDeployment[key];
  }

  const relink = await activator.unlinkChanged(
    keys.slice(),
    h.stagingDir,
    h.gameDir,
    () => undefined,
  );

  expect(relink).toEqual(keys.filter((key) => !failing.includes(key)));
});

const SHARED = "d3d9.dll";
const twoTypesSharingAGameFile = {
  files: { [SHARED]: "enb" },
  modName: "Enb",
  otherMods: { Dinput: { [SHARED]: "dinput" } },
};

test("a second mod type deploying over a game file keeps the game's original backup", async ({
  makeDeployment,
}) => {
  const h = makeDeployment(twoTypesSharingAGameFile);
  nodeFs.writeFileSync(h.inGame(SHARED), "original");
  await h.deployMod("Dinput");

  await h.deployMod("Enb");

  expect(nodeFs.readFileSync(h.inGame(`${SHARED}${BACKUP_TAG}`), "utf8")).toBe("original");
  expect(nodeFs.readFileSync(h.inGame(SHARED), "utf8")).toBe("dinput");
});

test("disabling a mod type that could not back up a game file leaves the other type's file and the backup", async ({
  makeDeployment,
}) => {
  const h = makeDeployment(twoTypesSharingAGameFile);
  nodeFs.writeFileSync(h.inGame(SHARED), "original");
  await h.deployMod("Dinput");
  const enbManifest = await h.deployMod("Enb");

  await h.method.prepare(h.gameDir, true, enbManifest, h.normalize);
  await h.method.finalize("skyrimse", h.gameDir, h.stagingDir);

  expect(nodeFs.readFileSync(h.inGame(SHARED), "utf8")).toBe("dinput");
  expect(nodeFs.readFileSync(h.inGame(`${SHARED}${BACKUP_TAG}`), "utf8")).toBe("original");
});

test("removes the folders a deployment emptied before the deployment completes", async ({
  makeDeployment,
}) => {
  const h = makeDeployment({ files: { "SKSE/Plugins/po3_Tweaks.ini": "[General]" } });
  await h.deploy();

  // a full deployment with the mod disabled: nothing is activated
  await h.method.prepare(h.gameDir, true, h.manifest(), h.normalize);
  await h.method.finalize("skyrimse", h.gameDir, h.stagingDir);

  expect(nodeFs.existsSync(h.inGame("SKSE"))).toBe(false);
});
