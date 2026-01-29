/* eslint-disable max-lines-per-function */
import path from "path";
import semver from "semver";
import { actions, fs, log, selectors, types, util } from "vortex-api";

import {
  getDownload,
  getSupportMap,
  NEXUS,
  MODTYPE_BIX_INJECTOR,
} from "./common";
import {
  IBepInExGameConfig,
  INexusDownloadInfo,
  NotPremiumError,
} from "./types";

import { checkForUpdates, downloadFromGithub } from "./githubDownloader";

function genDownloadProps(api: types.IExtensionApi, archiveName: string) {
  const state = api.getState();
  const downloads: { [dlId: string]: types.IDownload } = util.getSafe(
    state,
    ["persistent", "downloads", "files"],
    {},
  );
  const downloadId = Object.keys(downloads).find(
    (dId) => downloads[dId].localPath === archiveName,
  );
  return { downloads, downloadId, state };
}

function updateSupportedGames(
  api: types.IExtensionApi,
  downloadInfo: INexusDownloadInfo,
) {
  const { downloadId, downloads } = genDownloadProps(
    api,
    downloadInfo.archiveName,
  );
  if (downloadId === undefined) {
    throw new util.NotFound(
      `bepinex download is missing: ${downloadInfo.archiveName}`,
    );
  }

  const currentlySupported = downloads[downloadId].game;
  const supportedGames = new Set<string>(
    currentlySupported.concat(Object.keys(getSupportMap())),
  );
  api.store.dispatch(
    actions.setCompatibleGames(downloadId, Array.from(supportedGames)),
  );
}

async function install(
  api: types.IExtensionApi,
  downloadInfo: INexusDownloadInfo,
  downloadId: string,
  force?: boolean,
): Promise<string> {
  const state = api.getState();
  if (downloadInfo.allowAutoInstall) {
    const mods: { [modId: string]: types.IMod } = util.getSafe(
      state,
      ["persistent", "mods", downloadInfo.gameId],
      {},
    );
    const isInjectorInstalled = force
      ? false
      : Object.keys(mods).find(
          (id) => mods[id].type === MODTYPE_BIX_INJECTOR,
        ) !== undefined;
    if (!isInjectorInstalled) {
      return new Promise<string>((resolve, reject) => {
        api.events.emit(
          "start-install-download",
          downloadId,
          true,
          (err, modId) => {
            return err ? reject(err) : resolve(modId);
          },
        );
      });
    } else {
      return Promise.resolve(undefined);
    }
  }
}

async function download(
  api: types.IExtensionApi,
  downloadInfo: INexusDownloadInfo,
  force?: boolean,
) {
  const { domainId, modId, fileId, archiveName, allowAutoInstall } =
    downloadInfo;
  const state = api.getState();
  if (
    !util.getSafe(
      state,
      ["persistent", "nexus", "userInfo", "isPremium"],
      false,
    )
  ) {
    return Promise.reject(new NotPremiumError());
  }

  const downloadId = genDownloadProps(api, archiveName).downloadId;
  if (downloadId !== undefined) {
    try {
      updateSupportedGames(api, downloadInfo);
      return install(api, downloadInfo, downloadId, force);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  return api
    .emitAndAwait(
      "nexus-download",
      domainId,
      modId,
      fileId,
      archiveName,
      allowAutoInstall,
    )
    .then(() => {
      const { downloadId } = genDownloadProps(api, downloadInfo.archiveName);
      try {
        updateSupportedGames(api, downloadInfo);
        return install(api, downloadInfo, downloadId, force);
      } catch (err) {
        return Promise.reject(err);
      }
    })
    .catch((err) => {
      if (err instanceof util.UserCanceled) {
        log("info", "user canceled download of BepInEx");
      } else {
        log(
          "error",
          "failed to download from NexusMods.com",
          JSON.stringify(downloadInfo, undefined, 2),
        );
        err["attachLogOnReport"] = true;
        api.showErrorNotification("Failed to download BepInEx dependency", err);
      }
    });
}

export async function ensureBepInExPack(
  api: types.IExtensionApi,
  gameMode?: string,
  force?: boolean,
  isUpdate?: boolean,
) {
  const state = api.getState();
  const gameId =
    gameMode === undefined ? selectors.activeGameId(state) : gameMode;
  const profileId = selectors.lastActiveProfileForGame(state, gameId);
  const gameConf: IBepInExGameConfig = getSupportMap()[gameId];
  if (gameConf === undefined || !gameConf.autoDownloadBepInEx) {
    return;
  }

  const mods: { [modId: string]: types.IMod } = util.getSafe(
    state,
    ["persistent", "mods", gameId],
    {},
  );
  const injectorModIds = Object.keys(mods).filter(
    (id) => mods[id]?.type === MODTYPE_BIX_INJECTOR,
  );
  if (
    gameConf.bepinexVersion !== undefined &&
    gameConf.forceGithubDownload !== true
  ) {
    const hasRequiredVersion = injectorModIds.reduce((prev, iter) => {
      let version: string = mods[iter]?.attributes?.version ?? "0.0.0";
      if (version.length > 6) {
        // Ugly hack but people are pointlessly adding 0s to the end of the version.
        //  AFAICT the only reason they do this is for the sake of configuration
        //  changes which we don't need.
        version = version.slice(0, 6);
      }
      const modVersion = semver.coerce(version)?.raw || "0.0.0";
      if (modVersion === gameConf.bepinexVersion) {
        prev = true;
      }
      return prev;
    }, false);
    if (!hasRequiredVersion) {
      force = true;
    }
  } else if (gameConf.forceGithubDownload === true && isUpdate) {
    const latest = injectorModIds.reduce((prev, iter) => {
      let version: string = mods[iter]?.attributes?.version ?? "0.0.0";
      try {
        const coerced = semver.coerce(mods[iter]?.attributes?.version);
        version = coerced.raw || "0.0.0";
      } catch (err) {
        version = "0.0.0";
      }
      if (semver.gt(version, prev)) {
        prev = version;
      }
      return prev;
    }, "0.0.0");
    try {
      await checkForUpdates(api, gameConf, latest);
    } catch (err) {
      api.showErrorNotification("Failed to update BepInEx", err);
    }
    return;
  }

  const isInjectorInstalled = !force
    ? Object.keys(mods).find((id) => mods[id].type === MODTYPE_BIX_INJECTOR) !==
      undefined
    : false;

  if (isInjectorInstalled) {
    // We have a mod installed with the injector modType, do nothing.
    return;
  }

  let downloadRes;
  if (gameConf.customPackDownloader !== undefined) {
    try {
      downloadRes = await gameConf.customPackDownloader(
        util.getVortexPath("temp"),
      );
      if ((downloadRes as INexusDownloadInfo) !== undefined) {
        await download(api, downloadRes as INexusDownloadInfo, force);
      } else if (typeof downloadRes === "string") {
        if (!path.isAbsolute(downloadRes)) {
          log(
            "error",
            "failed to download custom pack",
            "expected absolute path",
          );
        }
        const downloadsPath = selectors.downloadPathForGame(state, gameId);
        await fs.copyAsync(
          downloadRes,
          path.join(downloadsPath, path.basename(downloadRes)),
        );
      } else {
        log("error", "failed to download custom pack", { downloadRes });
        return;
      }
    } catch (err) {
      if (err instanceof NotPremiumError) {
        const downloadInfo = downloadRes as INexusDownloadInfo;
        const url =
          path.join(NEXUS, downloadInfo.domainId, "mods", downloadInfo.modId) +
          `?tab=files&file_id=${downloadRes.fileId}&nmm=1`;
        util.opn(url).catch((err2) =>
          api.showErrorNotification("Failed to download custom pack", err2, {
            allowReport: false,
          }),
        );
      }
      log("error", "failed to download custom pack", err);
      return;
    }
  } else if (gameConf.forceGithubDownload !== true) {
    const defaultDownload = getDownload(gameConf);
    try {
      if (
        !!gameConf.bepinexVersion &&
        gameConf.bepinexVersion !== defaultDownload.version
      ) {
        // Go to Github instead!
        throw new util.ProcessCanceled("BepInEx version mismatch");
      }
      await download(api, defaultDownload, force);
    } catch (err) {
      await downloadFromGithub(api, gameConf);
    }
  } else {
    try {
      await downloadFromGithub(api, gameConf);
    } catch (err) {
      return Promise.reject(err);
    }
  }
}

export async function raiseConsentDialog(
  api: types.IExtensionApi,
  gameConf: IBepInExGameConfig,
) {
  const t = api.translate;
  const replace = {
    game: gameConf.gameId,
    bl: "[br][/br][br][/br]",
  };
  return api.showDialog(
    "info",
    "BepInEx Required",
    {
      bbcode: t(
        "The {{game}} game extension requires a widely used 3rd party assembly " +
          "patching/injection library called Bepis Injector Extensible (BepInEx).{{bl}}" +
          "Vortex can walk you through the download/installation process; once complete, BepInEx " +
          "will be available in your mods page to enable/disable just like any other regular mod. " +
          "Depending on the modding pattern of {{game}}, BepInEx may be a hard requirement " +
          "for mods to function in-game, in which case you MUST have the library enabled and deployed " +
          "at all times for the mods to work!{{bl}}" +
          "To remove the library, simply disable the mod entry for BepInEx.",
        { replace },
      ),
    },
    [
      { label: "Close" },
      {
        label: "Download BepInEx",
        default: true,
      },
    ],
  );
}

// async function downloadFromGithub(api: types.IExtensionApi, dlInfo: INexusDownloadInfoExt) {
//   const t = api.translate;
//   const replace = {
//     archiveName: dlInfo.archiveName,
//   };
//   const instructions = t('Once you allow Vortex to browse to GitHub - '
//     + 'Please scroll down and click on "{{archiveName}}"', { replace });
//   return new Promise((resolve, reject) => {
//     api.emitAndAwait('browse-for-download', dlInfo.githubUrl, instructions)
//       .then((result: string[]) => {
//         if (!result || !result.length) {
//           // If the user clicks outside the window without downloading.
//           return reject(new util.UserCanceled());
//         }
//         if (!result[0].includes(dlInfo.archiveName)) {
//           return reject(new util.ProcessCanceled('Selected wrong download'));
//         }
//         api.events.emit('start-download', [result[0]], {}, undefined,
//           (error, id) => {
//             if (error !== null) {
//               return reject(error);
//             }
//             api.events.emit('start-install-download', id, true, (err, modId) => {
//               if (err) {
//                 // Error notification gets reported by the event listener
//                 log('error', 'Error installing download', err);
//               }
//               return resolve(undefined);
//             });
//           }, 'never');
//       });
//   })
//   .catch(err => {
//     if (err instanceof util.UserCanceled) {
//       return Promise.resolve();
//     } else {
//       return downloadFromGithub(api, dlInfo);
//     }
//   });
// }
