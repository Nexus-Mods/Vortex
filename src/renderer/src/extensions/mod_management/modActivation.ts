import * as path from "path";

import type { IExtensionApi } from "../../types/IExtensionContext";
import type {
  IDeployedFile,
  IDeploymentMethod,
} from "./types/IDeploymentMethod";
import type { IMod } from "./types/IMod";
import type BlacklistSet from "./util/BlacklistSet";

import { log } from "../../logging";
import { UserCanceled } from "../../util/CustomErrors";
import * as fs from "../../util/fs";
import getNormalizeFunc, { type Normalize } from "../../util/getNormalizeFunc";
import { truthy } from "../../util/util";
import { MERGED_PATH } from "./modMerging";
import renderModName from "./util/modName";

async function ensureWritable(api: IExtensionApi, modPath: string): Promise<void> {
  await fs.ensureDirWritableAsync(modPath, () =>
    api
      .showDialog(
        "question",
        "Access Denied",
        {
          text:
            "The mod folder for this game is not writable to your user account.\n" +
            "If you have admin rights on this system, Vortex can change the permissions " +
            "to allow it write access.",
        },
        [{ label: "Cancel" }, { label: "Allow access" }],
      )
      .then((result) =>
        result.action === "Cancel"
          ? Promise.reject(new UserCanceled())
          : Promise.resolve(),
      ),
  );
}

/**
 * activate a list of mod
 *
 * @export
 * @param {string} installationPath the path where mods are installed
 * @param {string} destinationPath the game mod path
 * @param {IMod[]} mods list of mods to activate (sorted from lowest to highest
 * priority)
 * @param {IDeploymentMethod} method the activator to use
 * @returns {Promise<void>}
 */
async function deployMods(
  api: IExtensionApi,
  gameId: string,
  installationPath: string,
  destinationPath: string,
  mods: IMod[],
  method: IDeploymentMethod,
  lastActivation: IDeployedFile[],
  typeId: string,
  skipFiles: BlacklistSet,
  subDir: (mod: IMod) => string,
  progressCB?: (name: string, progress: number) => void,
): Promise<IDeployedFile[]> {
  if (!truthy(destinationPath)) {
    return Promise.resolve([] as IDeployedFile[]);
  }

  log("info", "deploying", {
    gameId,
    typeId,
    installationPath,
    destinationPath,
  });

  try {
    await ensureWritable(api, destinationPath);
    const normalize: Normalize = await getNormalizeFunc(destinationPath);
    await method.prepare(destinationPath, true, lastActivation, normalize);

    for (let idx = 0; idx < mods.length; idx++) {
      const mod = mods[idx];
      if (progressCB !== undefined) {
        progressCB(renderModName(mod), Math.round((idx * 50) / mods.length));
      }
      const modPath = path.join(installationPath, mod.installationPath);
      if (mod.fileOverrides !== undefined) {
        mod.fileOverrides
          .map((file) => {
            const relPath = path.relative(destinationPath, file);
            const relPathWithSource = path.join(
              mod.installationPath,
              relPath,
            );
            const normRelPathWithSource = normalize(relPathWithSource);
            return normRelPathWithSource;
          })
          .forEach((file) => skipFiles.add(file));
      }
      await method.activate(
        modPath,
        mod.installationPath,
        subDir(mod),
        skipFiles,
      );
    }

    const mergePath = truthy(typeId)
      ? MERGED_PATH + "." + typeId
      : MERGED_PATH;

    await method.activate(
      path.join(installationPath, mergePath),
      mergePath,
      subDir(null),
      new Set<string>(),
    );
  } catch (err) {
    if (method.cancel !== undefined) {
      method.cancel(gameId, destinationPath, installationPath);
    }
    throw err;
  }

  const cb =
    progressCB === undefined
      ? undefined
      : (files: number, total: number) =>
          progressCB(`${files}/${total} files`, 50 + (files * 50) / total);
  return method.finalize(gameId, destinationPath, installationPath, cb);
}

export default deployMods;
