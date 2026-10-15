import type { Stats } from "node:fs";
import { lstat, readFile } from "node:fs/promises";
import * as path from "path";

import type msgpackT from "@msgpack/msgpack";
import { getErrorCode, getErrorMessageOrDefault, unknownToError } from "@vortex/shared";
import { sync as writeAtomicSync } from "write-file-atomic";

import { showDialog } from "../../../actions/notifications";
import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IGame } from "../../../types/IGame";
import type { IState } from "../../../types/IState";
import ConcurrencyLimiter from "../../../util/ConcurrencyLimiter";
import { ProcessCanceled, UserCanceled } from "../../../util/CustomErrors";
import * as fs from "../../../util/fs";
import { writeFileAtomic } from "../../../util/fsAtomic";
import getVortexPath from "../../../util/getVortexPath";
import type { TFunction } from "../../../util/i18n";
import { log } from "../../../util/log";
import { activeGameId, discoveryByGame, installPathForGame } from "../../../util/selectors";
import { getSafe } from "../../../util/storeHelper";
import { deBOM, makeQueue, truthy } from "../../../util/util";
import { getGame } from "../../gamemode_management/util/getGame";
import type { IDeploymentManifest, ManifestFormat } from "../types/IDeploymentManifest";
import type { IDeployedFile, IDeploymentMethod } from "../types/IDeploymentMethod";
import { deployedFilePath } from "./deployedFilePath";
import { getActivator, getCurrentActivator } from "./deploymentMethods";
import format_1 from "./manifest_formats/format_1";

const CURRENT_VERSION = 1;

const formats: { [version: number]: ManifestFormat } = {
  1: format_1,
};

/** A mod type's manifest in the deployment target and its two backups in the staging folder. */
function manifestPaths(deployPath: string, stagingPath: string, modType: string) {
  const typeTag = modType !== undefined && modType.length > 0 ? modType + "." : "";
  const fileName = `vortex.deployment.${typeTag}json`;
  return {
    manifestPath: path.join(deployPath, fileName),
    backupPath: path.join(stagingPath, fileName),
    binaryBackupPath: path.join(stagingPath, `vortex.deployment.${typeTag}msgpack`),
  };
}

function emptyManifest(instance: string): IDeploymentManifest {
  return {
    version: CURRENT_VERSION,
    instance,
    files: [],
  };
}

/**
 * since the manifest is read from disc, it could have been modified by the user.
 * Check it for correctness
 */
function repairManifest(input: IDeploymentManifest): IDeploymentManifest {
  if (!truthy(input.version)) {
    input.version = CURRENT_VERSION;
  }

  if (!truthy(input.instance)) {
    input.instance = "";
  }

  input.files = input.files.reduce((prev: IDeployedFile[], file: IDeployedFile) => {
    if (
      file !== null &&
      file.relPath !== undefined &&
      file.relPath !== null &&
      file.source !== undefined &&
      file.source !== null &&
      file.time !== undefined &&
      file.time !== null
    ) {
      prev.push(file);
    }
    return prev;
  }, [] as IDeployedFile[]);

  return input;
}

function readManifest(data: string | Buffer): IDeploymentManifest {
  if (data === "") {
    return undefined;
  }

  const msgpack: typeof msgpackT = require("@msgpack/msgpack");

  let parsed: IDeploymentManifest;
  try {
    parsed = typeof data === "string" ? JSON.parse(deBOM(data)) : msgpack.decode(data);
  } catch (err) {
    const newErr = new Error(`Failed to parse manifest: "${getErrorMessageOrDefault(err)}"`);
    // invalid input data, not a bug
    newErr["allowReport"] = false;
    throw newErr;
  }

  let lastVersion = 0;
  while (lastVersion < CURRENT_VERSION) {
    parsed = formats[parsed.version || 1](parsed);
    if (parsed.version === lastVersion && parsed.version < CURRENT_VERSION) {
      // this should not happen!
      throw new Error(`unsupported format upgrade ${parsed.version} -> ${CURRENT_VERSION}`);
    }
    lastVersion = parsed.version;
  }
  if (parsed.files === undefined) {
    parsed.files = [];
  }
  return repairManifest(parsed);
}

/** Whether the file at an entry's path is the deployed one; manifest times are whole seconds. */
function isDeployedFile(stats: Stats, file: IDeployedFile): boolean {
  return Math.abs(stats.mtime.getTime() - file.time) < 1000;
}

// manifests can list 100k files
const PRESENCE_CHECK_CONCURRENCY = 256;

/** The manifest entries whose deployed files or links are still in the deployment target. */
export async function filesStillDeployed(
  basePath: string,
  files: IDeployedFile[],
): Promise<IDeployedFile[]> {
  const limit = new ConcurrencyLimiter(PRESENCE_CHECK_CONCURRENCY);
  const present = await Promise.all(
    files.map((file) =>
      limit.do(() =>
        lstat(deployedFilePath(basePath, file.target, file.relPath)).then(
          // a link left behind is still Vortex's, whatever its target
          (stats) => stats.isSymbolicLink() || isDeployedFile(stats, file),
          (err: unknown) => getErrorCode(err) !== "ENOENT",
        ),
      ),
    ),
  );
  return files.filter((_file, idx) => present[idx]);
}

/** Saves a mod type's manifest after a purge, listing the deployed files it left behind. */
export async function savePurgeLeftovers(
  gameId: string,
  modType: string,
  instance: string,
  deployPath: string,
  stagingPath: string,
  deployed: IDeployedFile[],
  activatorId: string,
): Promise<void> {
  await saveActivation(
    gameId,
    modType,
    instance,
    deployPath,
    stagingPath,
    await filesStillDeployed(deployPath, deployed),
    activatorId,
  );
}

export function purgeDeployedFiles(basePath: string, files: IDeployedFile[]): Promise<void> {
  return Promise.all(
    files.map((file) => {
      const fullPath = deployedFilePath(basePath, file.target, file.relPath);
      return fs
        .statAsync(fullPath)
        .then((stats) => {
          return isDeployedFile(stats, file) ? fs.unlinkAsync(fullPath) : Promise.resolve();
        })
        .catch((err: unknown) => {
          if (getErrorCode(err) !== "ENOENT") {
            return Promise.reject(err);
          } // otherwise ignore
        });
    }),
  ).then(() => undefined);
}

function queryPurgeTextSafe(t: TFunction) {
  return t(
    "IMPORTANT: This game was modded by another instance of Vortex.\n\n" +
      "If you switch between different instances (or between shared and " +
      "single-user mode) it's better if you purge mods before switching.\n\n" +
      "Vortex can try to clean up now but this is less reliable (*) than doing it " +
      "from the instance that deployed the files in the first place.\n\n" +
      "If you modified any files in the game directory you should back them up " +
      "before continuing.\n\n" +
      "(*) This purge relies on a manifest of deployed files, created by that other " +
      "instance. Files that have been changed since that manifest was created " +
      "won't be removed to prevent data loss. If the manifest is damaged or " +
      'outdated the purge may be incomplete. When purging from the "right" instance ' +
      "the manifest isn't required, it can reliably deduce which files need to " +
      "be removed.",
  );
}

function queryPurgeTextUnsafe(t: TFunction) {
  return t(
    "IMPORTANT: This game was modded by another instance of Vortex.\n\n" +
      "Vortex can only proceed by purging the mods from that other instance.\n\n" +
      "This will irreversibly **destroy** the mod installations from that other " +
      "instance!\n\n" +
      "You should instead cancel now, open that other vortex instance and purge " +
      "from there. This can also be caused by switching between shared and " +
      "single-user mode.",
  );
}

function queryPurge(
  api: IExtensionApi,
  basePath: string,
  files: IDeployedFile[],
  safe: boolean,
): Promise<void> {
  const t = api.translate;
  const text = safe ? queryPurgeTextSafe(t) : queryPurgeTextUnsafe(t);
  return Promise.resolve(
    api.store.dispatch(
      showDialog(
        "info",
        t("Purge files from different instance?"),
        {
          text,
        },
        [{ label: "Cancel" }, { label: "Purge" }],
      ),
    ),
  ).then((result) => {
    if (result.action === "Purge") {
      return purgeDeployedFiles(basePath, files).catch((err: unknown) => {
        api.showErrorNotification("Purging failed", err, {
          allowReport: false,
        });
        return Promise.reject(new UserCanceled());
      });
    } else {
      return Promise.reject(new UserCanceled());
    }
  });
}

function readManifestFile(filePath: string): Promise<any> {
  return Promise.resolve(fs.readFileAsync(filePath, "utf8")).then((data) => readManifest(data));
}

function readManifestFileBinary(filePath: string): Promise<any> {
  return Promise.resolve(fs.readFileAsync(filePath)).then((data) => readManifest(data));
}

function getManifestImpl(
  api: IExtensionApi,
  instanceId: string,
  paths: ReturnType<typeof manifestPaths>,
): Promise<IDeploymentManifest> {
  const { manifestPath, backupPath, binaryBackupPath } = paths;
  return readManifestFile(manifestPath)
    .catch((err: unknown) => {
      if (err instanceof UserCanceled) {
        return Promise.reject(err);
      }
      const errObj = unknownToError(err);
      const code = getErrorCode(err);
      if (code === "ENOENT") {
        return emptyManifest(instanceId);
      }
      if (code === "EPERM") {
        errObj.message =
          `The manifest file "${manifestPath}" is inaccessible due to ` +
          "insufficient permissions.\nPlease ensure your Windows user account " +
          "has full read/write permissions to the manifest file and try again.";
        errObj["allowReport"] = false;
        return Promise.reject(errObj);
      }

      if (
        errObj.message.startsWith("Unexpected token") ||
        errObj.message.startsWith("Unexpected end of JSON input")
      ) {
        errObj.message =
          `The manifest file "${manifestPath}" is corrupted.\n` +
          'You should delete it, then immediately click the "Purge" button ' +
          'on the "Mods" page, then deploy again.';
      }

      return readManifestFileBinary(binaryBackupPath)
        .catch((inner: unknown) => {
          if (getErrorCode(inner) === "ENOENT") {
            return readManifestFile(backupPath);
          }
          throw inner;
        })
        .then((data) =>
          api
            .showDialog(
              "question",
              "Manifest damaged",
              {
                text:
                  "The deployment manifest has been corrupted.\n" +
                  "Fortunately we have a backup that seems to be intact.",
                parameters: {
                  filePath: manifestPath,
                },
              },
              [{ label: "Cancel" }, { label: "Restore from backup" }],
            )
            .then((result) => {
              if (result.action === "Cancel") {
                errObj["allowReport"] = false;
                return Promise.reject(errObj);
              } else {
                return Promise.resolve(data);
              }
            }),
        )
        .catch((backupErr: unknown) => {
          errObj.message += "\nBackup couldn't be read: " + unknownToError(backupErr).message;
          return Promise.reject(errObj);
        });
    })
    .then((manifest) => (manifest !== undefined ? manifest : emptyManifest(instanceId)));
}

/** Asks before purging files whose deployment method left the game folder with the only copy. */
async function confirmUnsafePurge(api: IExtensionApi): Promise<void> {
  const result = await api.showDialog(
    "question",
    "Purge mod files?",
    {
      text:
        "The game folder holds the only copy of these mod files. Purging deletes them " +
        "permanently.",
    },
    [{ label: "Cancel" }, { label: "Purge" }],
  );
  if (result.action !== "Purge") {
    throw new UserCanceled();
  }
}

export function fallbackPurgeType(
  api: IExtensionApi,
  activator: IDeploymentMethod,
  gameId: string,
  modType: string,
  deployPath: string,
  stagingPath: string,
): Promise<void> {
  const state: IState = api.store.getState();
  const instanceId = state.app.instanceId;

  return getManifestImpl(api, instanceId, manifestPaths(deployPath, stagingPath, modType))
    .then((tagObject) => {
      let result: Promise<void>;
      if (tagObject.files.length > 0) {
        let safe = true;
        if (tagObject.deploymentMethod !== undefined) {
          // a method that isn't installed can't vouch for its files
          const previousActivator = getActivator(tagObject.deploymentMethod);
          if (previousActivator === undefined || !previousActivator.isFallbackPurgeSafe) {
            safe = false;
          }
        }
        result = (safe ? Promise.resolve() : confirmUnsafePurge(api))
          .then(() => purgeDeployedFiles(deployPath, tagObject.files))
          .then(() =>
            saveActivation(
              gameId,
              modType,
              state.app.instanceId,
              deployPath,
              stagingPath,
              [],
              activator !== undefined ? activator.id : undefined,
            ),
          )
          .then(() => Promise.resolve());
      } else {
        result = Promise.resolve();
      }
      return result;
    })
    .catch((err: unknown) => Promise.reject(err));
}

/**
 * purge files using information from the manifest
 */
export async function fallbackPurge(api: IExtensionApi, gameId?: string): Promise<void> {
  const state: IState = api.store.getState();
  if (gameId === undefined) {
    gameId = activeGameId(state);
  }
  const gameDiscovery = discoveryByGame(state, gameId);
  const game: IGame = getGame(gameId);
  if (game === undefined || gameDiscovery?.path === undefined) {
    return Promise.reject(new ProcessCanceled("game got disabled"));
  }
  const modPaths = game.getModPaths(gameDiscovery.path);
  const stagingPath = installPathForGame(state, gameId);
  const activator = getCurrentActivator(state, gameId, false);

  for (const typeId of Object.keys(modPaths)) {
    await fallbackPurgeType(api, activator, gameId, typeId, modPaths[typeId], stagingPath);
  }
}

const activationQueue = makeQueue();

export function withActivationLock(func: () => PromiseLike<any>, tryOnly: boolean = false) {
  return activationQueue(func, tryOnly);
}

/** The files a mod type's manifest lists; none if another instance wrote it. */
export async function ownDeployedFiles(
  api: IExtensionApi,
  modType: string,
  deployPath: string,
  stagingPath: string,
): Promise<IDeployedFile[]> {
  const { instanceId } = api.getState().app;
  // a damaged manifest lists nothing, so the purge still runs
  let manifest: IDeploymentManifest | undefined;
  try {
    const { manifestPath } = manifestPaths(deployPath, stagingPath, modType);
    manifest = readManifest(await readFile(manifestPath, "utf8"));
  } catch {
    manifest = undefined;
  }
  return manifest?.instance === instanceId ? manifest.files : [];
}

/**
 * return a manifest (detailing which files are currently deployed by Vortex)
 * Please note that the manifest is intended only as kind of a fallback, core functionality
 * of Vortex is designed to work cleanly even if the manifest is deleted by the user and
 * the same should be true for any extension using this function: Work on the assumption
 * that the manifest may be missing or outdated.
 * @remarks
 * This call is expensive as it attempts to read the manifest every time. Store the
 * result or call infrequently to minimise allocations and/or lag.
 * @param api api
 * @param modType the mod type for which to retrieve the manifest, default mod type if undefined
 * @param gameId the game for which to retrieve the manifest, defaults to the current game.
 */
export function getManifest(
  api: IExtensionApi,
  modType?: string,
  gameId?: string,
): Promise<IDeploymentManifest> {
  const state: IState = api.store.getState();
  const instanceId = state.app.instanceId;

  try {
    if (gameId === undefined) {
      gameId = activeGameId(state);
    }

    if (modType === undefined) {
      modType = "";
    }

    const game = getGame(gameId);
    const discovery = getSafe(state, ["settings", "gameMode", "discovered", gameId], undefined);
    if (discovery?.path === undefined || game === undefined) {
      return Promise.resolve(emptyManifest(instanceId));
    }

    const stagingPath: string = installPathForGame(state, gameId);
    const deployPath: string = game.getModPaths(discovery.path)[modType];
    if (stagingPath === undefined || deployPath === undefined) {
      return Promise.resolve(emptyManifest(instanceId));
    }

    return getManifestImpl(api, instanceId, manifestPaths(deployPath, stagingPath, modType));
  } catch (err) {
    return Promise.reject(err);
  }
}

export function loadActivation(
  api: IExtensionApi,
  gameId: string,
  modType: string,
  deployPath: string,
  stagingPath: string,
  activator: IDeploymentMethod,
): Promise<IDeployedFile[]> {
  if (deployPath === undefined) {
    return Promise.resolve([]);
  }
  const state: IState = api.store.getState();
  const instanceId = state.app.instanceId;
  return getManifestImpl(api, instanceId, manifestPaths(deployPath, stagingPath, modType)).then(
    (tagObject) => {
      let result: Promise<IDeployedFile[]>;
      if (tagObject.instance !== instanceId && tagObject.files.length > 0) {
        let safe = true;
        if (tagObject.deploymentMethod !== undefined) {
          const previousActivator = getActivator(tagObject.deploymentMethod);
          if (previousActivator !== undefined && !previousActivator.isFallbackPurgeSafe) {
            safe = false;
          }
        }
        result = queryPurge(api, deployPath, tagObject.files, safe)
          .then(() =>
            saveActivation(
              gameId,
              modType,
              state.app.instanceId,
              deployPath,
              stagingPath,
              [],
              activator.id,
            ),
          )
          .then(() => Promise.resolve([]));
      } else {
        result = Promise.resolve(tagObject.files);
      }
      return result;
    },
  );
}

export function saveActivation(
  gameId: string,
  modType: string,
  instance: string,
  gamePath: string,
  stagingPath: string,
  activation: IDeployedFile[],
  activatorId?: string,
) {
  const dataRaw = {
    instance,
    version: CURRENT_VERSION,
    deploymentMethod: activatorId,
    gameId,
    deploymentTime: Date.now(),
    stagingPath,
    targetPath: gamePath,
    files: activation,
  };
  const dataJSON = JSON.stringify(dataRaw, undefined, 2);
  try {
    JSON.parse(dataJSON);
  } catch (err) {
    const failedPath = path.join(getVortexPath("temp"), "failed_manifest.json");
    fs.writeFileSync(failedPath, dataJSON, { encoding: "utf8" });
    const repErr = new Error(
      `failed to serialize deployment information: "${getErrorMessageOrDefault(err)}"`,
    );
    repErr["attachFilesOnReport"] = [failedPath];
    return Promise.reject(repErr);
  }
  const { manifestPath, backupPath, binaryBackupPath } = manifestPaths(
    gamePath,
    stagingPath,
    modType,
  );

  if (activation.length > 0) {
    // write backup synchronously
    try {
      const msgpack: typeof msgpackT = require("@msgpack/msgpack");
      writeAtomicSync(binaryBackupPath, Buffer.from(msgpack.encode(dataRaw)));
    } catch (err) {
      log("error", "Failed to write manifest backup", getErrorMessageOrDefault(err));
    }
  } else {
    try {
      fs.removeSync(binaryBackupPath);
    } catch (err) {
      const code = getErrorCode(err);
      if (code !== "ENOENT") {
        log("error", "failed to remove manifest backup", getErrorMessageOrDefault(err));
      }
    }
  }

  return activation.length === 0
    ? fs.removeAsync(manifestPath).catch(() => undefined)
    : writeFileAtomic(manifestPath, dataJSON).then(() =>
        fs.removeAsync(backupPath).catch((err: unknown) => {
          if (getErrorCode(err) === "ENOENT") {
            return null;
          }
          throw err;
        }),
      );
}
