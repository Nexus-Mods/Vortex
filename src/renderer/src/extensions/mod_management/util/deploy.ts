import { getErrorCode } from "@vortex/shared";
import { generate as shortid } from "shortid";

import { startActivity, stopActivity } from "../../../actions/session";
import { log } from "../../../logging";
import type {
  IDeployedFile,
  IDeploymentMethod,
  IExtensionApi,
} from "../../../types/IExtensionContext";
import type { IGame } from "../../../types/IGame";
import type { IProfile } from "../../../types/IState";
import { ProcessCanceled, TemporaryError } from "../../../util/CustomErrors";
import { withTrackedActivity } from "../../../util/errorHandling";
import {
  activeProfile,
  discoveryByGame,
  lastActiveProfileForGame,
  profileById,
} from "../../../util/selectors";
import { getSafe } from "../../../util/storeHelper";
import { truthy } from "../../../util/util";
import type { IModType } from "../../gamemode_management/types/IModType";
import { getGame } from "../../gamemode_management/util/getGame";
import { installPath, installPathForGame } from "../selectors";
import type { IMod } from "../types/IMod";
import {
  fallbackPurgeType,
  getManifest,
  loadActivation,
  saveActivation,
  withActivationLock,
} from "./activationStore";
import { getActivator, getCurrentActivator } from "./deploymentMethods";
import { NoDeployment } from "./exceptions";
import { dealWithExternalChanges } from "./externalChanges";
const MERGE_SUBDIR = "zzz_merge";

export function genSubDirFunc(game: IGame, modType: IModType): (mod: IMod) => string {
  const mergeModsOpt =
    modType !== undefined && modType.options.mergeMods !== undefined
      ? modType.options.mergeMods
      : game.mergeMods;

  if (typeof mergeModsOpt === "boolean") {
    return mergeModsOpt ? () => "" : (mod: IMod) => (mod !== null ? mod.id : MERGE_SUBDIR);
  } else {
    return (mod: IMod) => {
      try {
        return mergeModsOpt(mod);
      } catch (err) {
        // if the game doesn't implement generating a output path for the merge,
        // use the default
        if (mod === null) {
          return MERGE_SUBDIR;
        } else {
          throw err;
        }
      }
    };
  }
}

async function filterManifest(
  activator: IDeploymentMethod,
  deployPath: string,
  stagingPath: string,
  deployment: IDeployedFile[],
): Promise<IDeployedFile[]> {
  const results = await Promise.all(
    deployment.map(async (item) => ({
      item,
      keep: await activator.isDeployed(stagingPath, deployPath, item),
    })),
  );
  return results.filter((r) => r.keep).map((r) => r.item);
}

export async function loadAllManifests(
  api: IExtensionApi,
  deploymentMethod: IDeploymentMethod,
  gameId: string,
  modPaths: { [typeId: string]: string },
  stagingPath: string,
) {
  const modTypes = Object.keys(modPaths).filter((typeId) => truthy(modPaths[typeId]));

  const prev: { [typeId: string]: IDeployedFile[] } = {};
  for (const typeId of modTypes) {
    const deployment = await loadActivation(
      api,
      gameId,
      typeId,
      modPaths[typeId],
      stagingPath,
      deploymentMethod,
    );
    prev[typeId] = deployment;
  }
  return prev;
}

export function purgeMods(
  api: IExtensionApi,
  gameId?: string,
  isUnmanaging?: boolean,
): Promise<void> {
  const state = api.store.getState();
  let profile =
    gameId !== undefined
      ? profileById(state, lastActiveProfileForGame(state, gameId))
      : activeProfile(state);

  if (isUnmanaging && profile === undefined) {
    // This block intends to cater for a use case where the user is attempting
    //  to unmanage his game but has removed the last active profile manually
    //  through the profiles page. The user most definitely still has profiles
    //  for the game as the game entry gets removed if all have been deleted.
    // Given that the user is attempting to unmanage his game, we do not want
    //  to block him from purging the mods. Any profile will do.
    const profiles: { [profileId: string]: IProfile } = getSafe(
      state,
      ["persistent", "profiles"],
      {},
    );

    const profileId = Object.keys(profiles)
      .filter((id) => profiles[id].gameId === gameId)
      .pop();

    profile = profiles?.[profileId];
  }

  if (profile === undefined) {
    return Promise.reject(new TemporaryError("No active profile"));
  }

  const effectiveGameId = gameId ?? profile.gameId;

  return withTrackedActivity(
    "vortex.mod-management",
    "deployment.purge",
    {
      "deployment.gameId": effectiveGameId,
      "deployment.isUnmanaging": isUnmanaging ?? false,
    },
    () =>
      getManifest(api, "", gameId).then((manifest) => {
        if (manifest?.deploymentMethod !== undefined) {
          log("info", "using deployment method from manifest", {
            method: manifest?.deploymentMethod,
          });
          const deployedActivator = getActivator(manifest?.deploymentMethod);
          return purgeModsImpl(api, deployedActivator, profile);
        } else {
          return purgeModsImpl(api, undefined, profile).catch((err: unknown) => {
            // If the user is unmanaging the game and the purge was unable to find any
            //  of the game's mods path during the purge, that suggests that the user
            //  has uninstalled the game and is trying to "unmanage" the game.
            //  In this case, there's nothing left to purge so we can safely resolve.
            if (["ENOENT"].includes(getErrorCode(err)) && isUnmanaging) {
              return Promise.resolve();
            } else {
              return Promise.reject(err);
            }
          });
        }
      }),
  );
}

async function purgeModsImpl(
  api: IExtensionApi,
  activator: IDeploymentMethod,
  profile: IProfile,
): Promise<void> {
  const state = api.store.getState();
  const { gameId } = profile;
  const stagingPath = installPathForGame(state, gameId);
  const gameDiscovery = discoveryByGame(state, gameId);

  if (gameDiscovery?.path === undefined) {
    api.sendNotification({
      type: "info",
      id: "purge-not-possible",
      message: "Can't purge because game is not discovered",
      displayMS: 5000,
    });
    return;
  }

  log("info", "current deployment method is", {
    method: getCurrentActivator(state, gameId, false)?.id,
  });
  if (activator === undefined) {
    activator = getCurrentActivator(state, gameId, false);
  }

  if (activator === undefined || stagingPath === undefined) {
    // throwing this exception on stagingPath === undefined isn't exactly
    // accurate but the effect is the same: User has to activate the game
    // and review settings before deployment is possible
    throw new NoDeployment();
  }

  if (Object.keys(getSafe(state, ["session", "base", "toolsRunning"], {})).length > 0) {
    api.sendNotification({
      type: "info",
      id: "purge-not-possible",
      message: "Can't purge while the game or a tool is running",
      displayMS: 5000,
    });
    return;
  }

  const notificationId: string = shortid();

  const onProgress = (progress: number, message: string) => {
    api.sendNotification({
      id: notificationId,
      type: "activity",
      title: "Purging",
      message,
      progress,
    });
  };

  onProgress(0, "Waiting for other operations to complete");

  const game: IGame = getGame(gameId);
  const modPaths = game.getModPaths(gameDiscovery.path);

  const modTypes = Object.keys(modPaths).filter((typeId) => truthy(modPaths[typeId]));

  try {
    await withActivationLock(async () => {
      log("debug", "purging mods", { activatorId: activator.id, stagingPath });
      onProgress(0, "Preparing purge");

      let lastDeployment: { [typeId: string]: IDeployedFile[] };
      let purgeSucceeded = true;
      api.store.dispatch(startActivity("mods", "purging"));

      // TODO: we really should be using the deployment specified in the manifest,
      //   not the current one! This only works because we force a purge when switching
      //   deployment method.
      try {
        await activator.prePurge(stagingPath);

        const deployments = await loadAllManifests(api, activator, gameId, modPaths, stagingPath);
        lastDeployment = deployments;

        await api.emitAndAwait("will-purge", profile.id, lastDeployment);
        onProgress(10, "Removing links");

        await dealWithExternalChanges(
          api,
          activator,
          profile.id,
          stagingPath,
          modPaths,
          lastDeployment,
        );
        onProgress(25, "Removing links");

        for (const [idx, typeId] of modTypes.entries()) {
          const cover = 50 / modTypes.length;
          const progressType = (num: number, total: number) => {
            onProgress(25 + idx * cover + Math.floor((num * cover) / total), "Removing links");
          };
          await activator.purge(stagingPath, modPaths[typeId], gameId, progressType);
        }

        onProgress(75, "Saving updated manifest");

        await Promise.all(
          modTypes.map((typeId) =>
            saveActivation(
              gameId,
              typeId,
              state.app.instanceId,
              modPaths[typeId],
              stagingPath,
              [],
              activator.id,
            ),
          ),
        );
      } catch (err: unknown) {
        if (lastDeployment !== undefined) {
          await Promise.all(
            modTypes.map((typeId) =>
              filterManifest(activator, modPaths[typeId], stagingPath, lastDeployment[typeId]).then(
                (files) =>
                  saveActivation(
                    gameId,
                    typeId,
                    state.app.instanceId,
                    modPaths[typeId],
                    stagingPath,
                    files,
                    activator.id,
                  ),
              ),
            ),
          );
        }
        if (!(err instanceof ProcessCanceled)) {
          purgeSucceeded = false;
          throw err;
        }
      } finally {
        onProgress(85, "Post purge events");
        await activator.postPurge();
        if (purgeSucceeded) {
          await api.emitAndAwait("did-purge", profile.id);
        }
      }
    }, true);
  } finally {
    api.dismissNotification(notificationId);
    api.store.dispatch(stopActivity("mods", "purging"));
  }
}

export function purgeModsInPath(
  api: IExtensionApi,
  gameId: string,
  typeId: string,
  modPath: string,
): Promise<void> {
  const state = api.store.getState();
  const profile: IProfile =
    gameId !== undefined
      ? profileById(state, lastActiveProfileForGame(state, gameId))
      : activeProfile(state);

  if (gameId === undefined) {
    gameId = profile.gameId;
  }
  const stagingPath = installPathForGame(state, gameId);

  const t = api.translate;
  const activator = getCurrentActivator(state, gameId, false);

  if (activator === undefined) {
    return Promise.reject(new NoDeployment());
  }

  if (Object.keys(getSafe(state, ["session", "base", "toolsRunning"], {})).length > 0) {
    api.sendNotification({
      type: "info",
      id: "purge-not-possible",
      message: "Can't purge while the game or a tool is running",
      displayMS: 5000,
    });
    return Promise.resolve();
  }

  const notificationId: string = shortid();

  const onProgress = (progress: number, message: string) => {
    api.sendNotification({
      id: notificationId,
      type: "activity",
      title: "Purging",
      message,
      progress,
    });
  };

  onProgress(0, "Waiting for other operations to complete");

  return withTrackedActivity(
    "vortex.mod-management",
    "deployment.purge-path",
    {
      "deployment.gameId": gameId,
      "deployment.typeId": typeId,
      "deployment.modPath": modPath,
      "deployment.method": activator.name,
    },
    () =>
      withActivationLock(async () => {
        log("debug", "purging mods", { activatorId: activator.id, stagingPath });
        onProgress(0, "Preparing purge");

        if (gameId !== undefined && profile === undefined) {
          // gameId was set but we have no last active profile for that game.
          // In this case there is probably nothing to purge but if that's true
          // there will also be no manifest so we can just as easily try a fallback
          // purge just to be safe.
          return fallbackPurgeType(api, activator, gameId, typeId, modPath, stagingPath);
        }

        // TODO: we really should be using the deployment specified in the manifest,
        //   not the current one! This only works because we force a purge when switching
        //   deployment method.
        let purgeSucceeded = true;
        try {
          await activator.prePurge(stagingPath);
          onProgress(25, "Removing links");
          await activator.purge(stagingPath, modPath, gameId);
          onProgress(50, "Saving updated manifest");
          await saveActivation(
            gameId,
            typeId,
            state.app.instanceId,
            modPath,
            stagingPath,
            [],
            activator.id,
          );
        } catch (err: unknown) {
          if (!(err instanceof ProcessCanceled)) {
            purgeSucceeded = false;
            throw err;
          }
        } finally {
          onProgress(75, "Post purge events");
          await activator.postPurge();
          if (purgeSucceeded) {
            await api.emitAndAwait("did-purge", profile.id);
          }
        }
      }, true)
        .then(() => null)
        .finally(() => {
          api.dismissNotification(notificationId);
        }),
  );
}
