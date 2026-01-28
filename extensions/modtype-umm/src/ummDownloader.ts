import path from "path";
import { setTimeout } from "timers";
import { actions, fs, log, selectors, types, util } from "vortex-api";
import * as winapi from "winapi-bindings";
import { getDownload, getSupportMap, NEXUS, UMM_EXE } from "./common";
import { AutoInstallDisabledError, NotPremiumError } from "./Errors";
import { INexusDownloadInfo, IUMMGameConfig } from "./types";
import { setUMMPath } from "./util";

export async function ensureUMM(
  api: types.IExtensionApi,
  gameMode?: string,
  force?: boolean,
): Promise<string> {
  const state = api.getState();
  const gameId =
    gameMode === undefined ? selectors.activeGameId(state) : gameMode;
  const gameConf: IUMMGameConfig = getSupportMap()[gameId];
  if (gameConf === undefined || !gameConf.autoDownloadUMM) {
    return undefined;
  }

  const ummPath = await findUMMPath();
  if (ummPath !== undefined) {
    setUMMPath(api, ummPath, gameMode);
    return undefined;
  }

  const mods: { [modId: string]: types.IMod } = util.getSafe(
    state,
    ["persistent", "mods", gameId],
    {},
  );
  const dl = getDownload(gameConf);
  const ummModIds = Object.keys(mods).filter((id) => mods[id]?.type === "umm");
  const hasRequireVersion = ummModIds.reduce((prev, iter) => {
    if (mods[iter]?.attributes?.fileId === +dl.fileId) {
      prev = true;
    }
    return prev;
  }, false);
  if (!hasRequireVersion) {
    force = true;
  }

  try {
    const modId = await download(api, dl, force);
    return modId;
  } catch (err) {
    if (err instanceof AutoInstallDisabledError) {
      log("debug", "auto install is disabled", err);
      return Promise.resolve(undefined);
    }
    if (err instanceof NotPremiumError) {
      const t = api.translate;
      const replace = {
        game: gameMode,
        bl: "[br][/br][br][/br]",
      };
      api.showDialog(
        "info",
        "Unity Mod Manager Required",
        {
          bbcode: t(
            "The {{game}} game extension requires a 3rd party mod " +
              "patching/injection tool called Unity Mod Manager (UMM).{{bl}}" +
              "Vortex can walk you through the download/installation process; once complete, UMM " +
              "will be available as a tool in your dashboard." +
              "Depending on the modding pattern of {{game}}, UMM may be a hard requirement " +
              "for mods to function in-game, in which case you MUST have the tool installed " +
              "and configured to inject mods into your game. (run the tool for more info)",
            { replace },
          ),
        },
        [
          { label: "Close" },
          {
            label: "Download UMM",
            action: async () => {
              try {
                await downloadFromGithub(api, dl);
              } catch (err2) {
                err["attachLogOnReport"] = true;
                api.showErrorNotification(
                  "Failed to download UMM dependency",
                  err2,
                );
              }
            },
            default: true,
          },
        ],
      );
      return Promise.reject(err);
    }
    log("error", "failed to download default pack", err);
    return Promise.resolve(undefined);
  }
}

async function downloadFromGithub(
  api: types.IExtensionApi,
  dlInfo: INexusDownloadInfo,
) {
  const t = api.translate;
  const replace = {
    archiveName: dlInfo.archiveName,
  };
  const instructions = t(
    "Once you allow Vortex to browse to GitHub - " +
      'Please scroll down and click on "{{archiveName}}"',
    { replace },
  );
  return new Promise((resolve, reject) => {
    api
      .emitAndAwait("browse-for-download", dlInfo.githubUrl, instructions)
      .then((result: string[]) => {
        if (!result || !result.length) {
          // If the user clicks outside the window without downloading.
          return reject(new util.UserCanceled());
        }
        if (!result[0].includes(dlInfo.archiveName)) {
          return reject(new util.ProcessCanceled("Selected wrong download"));
        }
        api.events.emit(
          "start-download",
          [result[0]],
          {},
          undefined,
          async (error, id) => {
            if (error !== null) {
              return reject(error);
            }
            try {
              const modId = await finalize(api, dlInfo, id);
              return resolve(modId);
            } catch (err) {
              return reject(err);
            }
          },
          "never",
        );
      });
  }).catch((err) => {
    if (err instanceof util.UserCanceled) {
      return Promise.resolve();
    } else if (err instanceof util.ProcessCanceled) {
      return downloadFromGithub(api, dlInfo);
    } else {
      return Promise.reject(err);
    }
  });
}

function readRegistryKey(hive, key, name) {
  try {
    const instPath = winapi.RegGetValue(hive, key, name);
    if (!instPath) {
      throw new Error("empty registry key");
    }
    return instPath.value;
  } catch (err) {
    return undefined;
  }
}

function setRegistryKey(hive, key, name, value) {
  try {
    winapi.RegSetKeyValue(hive, key, name, value);
  } catch (err) {
    log("error", "failed to set registry key", err);
  }
}

async function findUMMPath(): Promise<string> {
  const value = readRegistryKey(
    "HKEY_CURRENT_USER",
    "Software\\UnityModManager",
    "Path",
  );
  try {
    await fs.statAsync(path.join(value.toString(), UMM_EXE));
    return value.toString();
  } catch (err) {
    return undefined;
  }
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
    const modId = Object.keys(mods).find((id) => mods[id].type === "umm");
    const isInjectorInstalled = force ? false : modId !== undefined;
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
      return Promise.resolve(modId);
    }
  }
  return Promise.reject(new AutoInstallDisabledError(downloadInfo));
}

async function finalize(
  api: types.IExtensionApi,
  downloadInfo: INexusDownloadInfo,
  dlId: string,
  force?: boolean,
) {
  const state = api.getState();
  try {
    updateSupportedGames(api, downloadInfo);
    const modId = await install(api, downloadInfo, dlId, force);
    if (modId === undefined) {
      throw new util.ProcessCanceled("UMM Installation failed.");
    }
    const staging = selectors.installPathForGame(state, downloadInfo.gameId);
    const mod = api.getState().persistent.mods[downloadInfo.gameId][modId];
    const ummPath = path.join(staging, mod.installationPath, UMM_EXE);
    setRegistryKey(
      "HKEY_CURRENT_USER",
      "Software\\UnityModManager",
      "Path",
      path.dirname(ummPath),
    );
    setRegistryKey(
      "HKEY_CURRENT_USER",
      "Software\\UnityModManager",
      "ExePath",
      ummPath,
    );
    setUMMPath(api, path.dirname(ummPath), downloadInfo.gameId);
    return Promise.resolve(modId);
  } catch (err) {
    return Promise.reject(err);
  }
}

async function download(
  api: types.IExtensionApi,
  downloadInfo: INexusDownloadInfo,
  force?: boolean,
): Promise<string> {
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

  const downloadId = genDownloadInfo(api, archiveName).downloadId;
  if (downloadId !== undefined) {
    return finalize(api, downloadInfo, downloadId, force);
  }

  const autoInstallEnabled = state.settings.automation?.["install"];
  if (autoInstallEnabled) {
    // Leaving auto install enabled will cause the UMM download
    //  to attempt to install the download as an extension given
    //  that UMM is hosted on the 'site' game domain.
    api.store.dispatch(actions.setAutoInstall(false));
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
    .then(async () => {
      const dlData = genDownloadInfo(api, downloadInfo.archiveName);
      return finalize(api, downloadInfo, dlData.downloadId, force) as any;
    })
    .catch(async (err) => {
      if (err instanceof AutoInstallDisabledError) {
        return Promise.resolve();
      }
      log("error", "failed to download from NexusMods.com", {
        dlInfo: JSON.stringify(downloadInfo, undefined, 2),
        error: err,
      });
      try {
        await downloadFromGithub(api, downloadInfo);
        return Promise.resolve();
      } catch (err2) {
        err2["attachLogOnReport"] = true;
        api.showErrorNotification("Failed to download UMM dependency", err2);
      }
    })
    .finally(() => {
      if (autoInstallEnabled) {
        // Restore auto install setting.
        api.store.dispatch(actions.setAutoInstall(true));
      }
    });
}

function genDownloadInfo(api: types.IExtensionApi, archiveName: string) {
  const state = api.getState();
  const downloads: { [dlId: string]: types.IDownload } = util.getSafe(
    state,
    ["persistent", "downloads", "files"],
    {},
  );
  const downloadId = Object.keys(downloads).find(
    (dId) =>
      downloads[dId].localPath.toUpperCase() === archiveName.toUpperCase(),
  );
  return { downloads, downloadId, state };
}

function updateSupportedGames(
  api: types.IExtensionApi,
  downloadInfo: INexusDownloadInfo,
) {
  const { downloadId, downloads } = genDownloadInfo(
    api,
    downloadInfo.archiveName,
  );
  if (downloadId === undefined) {
    throw new util.NotFound(
      `UMM download is missing: ${downloadInfo.archiveName}`,
    );
  }

  const currentlySupported = downloads[downloadId].game;
  const supportedGames = new Set<string>(
    currentlySupported.concat(Object.keys(getSupportMap())),
  );
  api.store.dispatch(
    actions.setCompatibleGames(
      downloadId,
      Array.from(supportedGames).sort((lhs, rhs) =>
        lhs === "site" ? -1 : lhs.length - rhs.length,
      ),
    ),
  );
}
