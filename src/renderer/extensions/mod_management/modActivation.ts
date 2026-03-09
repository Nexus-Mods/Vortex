import type { IExtensionApi } from "../../types/IExtensionContext";
import * as fs from "../../util/fs";
import getNormalizeFunc, { type Normalize } from "../../util/getNormalizeFunc";
import { log } from "../../util/log";
import { truthy } from "../../util/util";

import type BlacklistSet from "./util/BlacklistSet";
import type {
  IDeployedFile,
  IDeploymentMethod,
} from "./types/IDeploymentMethod";
import type { IMod } from "./types/IMod";
import renderModName from "./util/modName";

import { MERGED_PATH } from "./modMerging";

import PromiseBB from "bluebird";
import * as path from "path";
import { UserCanceled } from "../../util/CustomErrors";
import { getErrorMessageOrDefault } from "@vortex/shared";

function ensureWritable(api: IExtensionApi, modPath: string): PromiseBB<void> {
  return fs.ensureDirWritableAsync(modPath, () =>
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
          ? PromiseBB.reject(new UserCanceled())
          : PromiseBB.resolve(),
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
 * @returns {PromiseBB<void>}
 */
function deployMods(
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
): PromiseBB<IDeployedFile[]> {
  if (!truthy(destinationPath)) {
    return PromiseBB.resolve([]);
  }

  log("info", "deploying", {
    gameId,
    typeId,
    installationPath,
    destinationPath,
  });

  let normalize: Normalize;
  return ensureWritable(api, destinationPath)
    .then(() => getNormalizeFunc(destinationPath))
    .then((norm) => {
      normalize = norm;
      return method.prepare(destinationPath, true, lastActivation, norm);
    })
    .then(() =>
      PromiseBB.each(mods, (mod, idx, length) => {
        try {
          if (progressCB !== undefined) {
            progressCB(renderModName(mod), Math.round((idx * 50) / length));
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
          return method.activate(
            modPath,
            mod.installationPath,
            subDir(mod),
            skipFiles,
          );
        } catch (err) {
          log("error", "failed to deploy mod", {
            err: getErrorMessageOrDefault(err),
            id: mod.id,
          });
        }
      }),
    )
    .then(() => {
      const mergePath = truthy(typeId)
        ? MERGED_PATH + "." + typeId
        : MERGED_PATH;

      return method.activate(
        path.join(installationPath, mergePath),
        mergePath,
        subDir(null),
        new Set<string>(),
      );
    })
    .tapCatch(() => {
      if (method.cancel !== undefined) {
        method.cancel(gameId, destinationPath, installationPath);
      }
    })
    .then(() => {
      const cb =
        progressCB === undefined
          ? undefined
          : (files: number, total: number) =>
              progressCB(`${files}/${total} files`, 50 + (files * 50) / total);
      return method.finalize(gameId, destinationPath, installationPath, cb);
    });
}

export default deployMods;
