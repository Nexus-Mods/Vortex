import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { UserCanceled } from "@vortex/shared/errors";
import { expect } from "vitest";

import { makeDeployedFile } from "../../../test-utils/builders";
import { makeDeployedGame } from "../../../test-utils/deployedGame";
import { test } from "../../../test-utils/harnessTest";
import { makeTempDir } from "../../../test-utils/tempDir";
import type { IExtensionContext } from "../../../types/IExtensionContext";
import hardlinkInit from "../../hardlink_activator";
import moveInit from "../../move_activator";
import { fallbackPurge, filesStillDeployed } from "./activationStore";
import { registerDeploymentMethod } from "./deploymentMethods";

const MOVE_METHOD = "move_activator";
const HARDLINK_METHOD = "hardlink_activator";

// move's deployments are unsafe for the fallback purge, hardlink's aren't
for (const init of [hardlinkInit, moveInit]) {
  init({ api: {}, registerDeploymentMethod } as unknown as IExtensionContext);
}

test("the fallback purge restores a damaged manifest from its staging backup", async () => {
  const game = await makeDeployedGame();
  const file = await game.deployFile("plugin.esp");
  await game.saveManifest([file], HARDLINK_METHOD);
  await writeFile(path.join(game.dataPath, "vortex.deployment.json"), '{"damaged');
  game.setNextDialog({ action: "Restore from backup", input: {} });

  await fallbackPurge(game.api, game.gameId);

  expect(game.isDeployed(file)).toBe(false);
});

test("the fallback purge removes files deployed into a mod's subfolder", async () => {
  const game = await makeDeployedGame();
  const file = await game.deployFile(path.join("Config", "test.xml"), "SomeMod");
  await game.saveManifest([file], HARDLINK_METHOD);

  await fallbackPurge(game.api, game.gameId);

  expect(game.isDeployed(file)).toBe(false);
});

test("the fallback purge keeps files a move deployment left when the user cancels", async () => {
  const game = await makeDeployedGame();
  const file = await game.deployFile("plugin.esp");
  await game.saveManifest([file], MOVE_METHOD);
  game.setNextDialog({ action: "Cancel", input: {} });

  await expect(fallbackPurge(game.api, game.gameId)).rejects.toBeInstanceOf(UserCanceled);

  expect(game.isDeployed(file)).toBe(true);
  expect(game.dialogCalls).toHaveLength(1);
});

test("the fallback purge asks before purging files of a deployment method that isn't installed", async () => {
  const game = await makeDeployedGame();
  const file = await game.deployFile("plugin.esp");
  await game.saveManifest([file], "uninstalled-method");
  game.setNextDialog({ action: "Cancel", input: {} });

  await expect(fallbackPurge(game.api, game.gameId)).rejects.toBeInstanceOf(UserCanceled);

  expect(game.isDeployed(file)).toBe(true);
});

test("the fallback purge keeps a file older than the one it deployed", async () => {
  const game = await makeDeployedGame();
  const original = await game.deployFile("Video/BGS_Logo.bik");
  const deployedLater = { ...original, time: original.time + 60_000 };
  await game.saveManifest([deployedLater], HARDLINK_METHOD);

  await fallbackPurge(game.api, game.gameId);

  expect(game.isDeployed(original)).toBe(true);
});

test("the fallback purge removes files a move deployment left when the user confirms", async () => {
  const game = await makeDeployedGame();
  const file = await game.deployFile("plugin.esp");
  await game.saveManifest([file], MOVE_METHOD);
  game.setNextDialog({ action: "Purge", input: {} });

  await fallbackPurge(game.api, game.gameId);

  expect(game.isDeployed(file)).toBe(false);
});

test("a link left in the deployment target counts as deployed after its target is gone", async () => {
  const root = await makeTempDir("vortex-still-deployed-");
  const linkTarget = path.join(root, "staging", "mod-1", "textures");
  await mkdir(linkTarget, { recursive: true });
  // a junction needs no privilege on Windows; elsewhere node makes a plain symlink
  await symlink(linkTarget, path.join(root, "textures"), "junction");
  await rm(linkTarget, { recursive: true });
  const dangling = makeDeployedFile({ relPath: "textures" });
  const purged = makeDeployedFile({ relPath: "purged.esp" });

  expect(await filesStillDeployed(root, [dangling, purged])).toEqual([dangling]);
});

test("a game file put back where a deployed file was doesn't count as deployed", async () => {
  const game = await makeDeployedGame();
  const deployed = await game.deployFile("plugin.esp");
  const original = await game.deployFile("Video/BGS_Logo.bik");
  const replacedOriginal = { ...original, time: original.time + 60_000 };

  expect(await filesStillDeployed(game.dataPath, [deployed, replacedOriginal])).toEqual([deployed]);
});
