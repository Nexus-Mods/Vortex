import { existsSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { STAGING_DIR_TAG } from "../extensions/mod_management/stagingDirectory";
import type { IDeployedFile } from "../extensions/mod_management/types/IDeploymentMethod";
import { getManifest, saveActivation } from "../extensions/mod_management/util/activationStore";
import BlacklistSet from "../extensions/mod_management/util/BlacklistSet";
import { deployedFilePath } from "../extensions/mod_management/util/deployedFilePath";
import getNormalizeFunc from "../util/getNormalizeFunc";
import {
  makeBlacklistGame,
  makeDeployedFile,
  makeGameHarness,
  makeMod,
  type IHarnessReducerBinding,
} from "./builders";
import type { IDeployedGameHarness } from "./harnessTypes";
import { makeTempDir, writeInto } from "./tempDir";

const INSTANCE_ID = "this-instance";

export interface IDeployedGameOpts {
  // the game's configured deployment method (state.settings.mods.activator); none unless set
  methodId?: string;
  // write the staging folder's tag, which the staging check on game activation looks for
  stagingTag?: boolean;
  // reducers for slices beyond the harness defaults
  extraReducers?: IHarnessReducerBinding[];
}

/** A managed game over real temporary game and staging folders. */
export async function makeDeployedGame(
  opts: IDeployedGameOpts = {},
): Promise<IDeployedGameHarness> {
  const root = await makeTempDir("vortex-deployed-game-");
  const stagingPath = path.join(root, "staging");
  await mkdir(stagingPath, { recursive: true });
  if (opts.stagingTag) {
    await writeFile(path.join(stagingPath, STAGING_DIR_TAG), "{}");
  }
  const harness = makeGameHarness(
    {
      gamePath: path.join(root, "game"),
      installPath: { skyrimse: stagingPath },
      instanceId: INSTANCE_ID,
      activatorId: opts.methodId,
    },
    opts.extraReducers,
  );

  const saveManifest = (files: IDeployedFile[], methodId: string) =>
    saveActivation(harness.gameId, "", INSTANCE_ID, harness.dataPath, stagingPath, files, methodId);

  return {
    ...harness,
    deployMods: async (method, modIds) => {
      harness.setState((draft) => {
        for (const modId of modIds) {
          draft.persistent.mods[harness.gameId][modId] = makeMod({
            id: modId,
            installationPath: modId,
          });
        }
      });
      const normalize = await getNormalizeFunc(harness.dataPath);
      const blacklist = new BlacklistSet([], makeBlacklistGame(), normalize);
      const { files } = await getManifest(harness.api, "", harness.gameId);
      await method.prepare(harness.dataPath, false, files, normalize);
      try {
        for (const modId of modIds) {
          await writeInto(path.join(stagingPath, modId), `${modId}.esp`);
          await method.activate(path.join(stagingPath, modId), modId, "", blacklist);
        }
      } catch (err) {
        await method.cancel?.(harness.gameId, harness.dataPath, stagingPath);
        throw err;
      }
      await saveManifest(
        await method.finalize(harness.gameId, harness.dataPath, stagingPath),
        method.id,
      );
    },
    deployFile: async (relPath, target) => {
      const filePath = deployedFilePath(harness.dataPath, target, relPath);
      await writeInto(path.dirname(filePath), path.basename(filePath));
      const { mtimeMs } = await stat(filePath);
      return makeDeployedFile({ relPath, target, time: Math.floor(mtimeMs) });
    },
    saveManifest,
    recordedFiles: async () =>
      (await getManifest(harness.api, "", harness.gameId)).files.map((file) => file.relPath),
    isDeployed: (file) => existsSync(deployedFilePath(harness.dataPath, file.target, file.relPath)),
  };
}

/** A game whose purge left left-behind.esp and removed purged.esp; the manifest lists both. */
export async function makeHalfPurgedGame(
  methodId: string,
  opts: Omit<IDeployedGameOpts, "methodId"> = {},
): Promise<IDeployedGameHarness> {
  const game = await makeDeployedGame({ ...opts, methodId });
  const leftBehind = await game.deployFile("left-behind.esp");
  await game.saveManifest([leftBehind, makeDeployedFile({ relPath: "purged.esp" })], methodId);
  return game;
}
