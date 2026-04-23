/**
 * BepInEx pack downloader / installer.
 *
 * `ensureBepInExPack` is the entry point invoked from `gamemode-activated`,
 * `will-deploy` and (with `force=true`) from the `check-mods-version`
 * `forceUpdate` flow. It decides whether the configured BepInEx pack needs
 * to be (re-)downloaded for the active game and, if so, dispatches to the
 * appropriate download source.
 *
 * Decision flow (in order):
 *
 *   1. Bail out unless the game is registered with `addGameSupport` AND has
 *      `autoDownloadBepInEx: true`.
 *   2. Pinned-version check (sets `force=true` when the installed injector
 *      doesn't match the pinned version):
 *        - runs only when `bepinexVersion` is set, `forceGithubDownload` is
 *          NOT set, and `customPackDownloader` is NOT set.
 *        - skipped for `customPackDownloader` extensions because that
 *          resolver owns version selection - re-pinning here would loop on
 *          every deploy whenever the resolver returns a version that
 *          differs from the pin.
 *   3. Github-update mode (`forceGithubDownload && isUpdate`): query Github
 *      for a newer release and exit. Does not install on its own.
 *   4. If an injector mod is already installed and `force` is not set,
 *      return without doing anything.
 *   5. Dispatch a download in priority order:
 *        a. `customPackDownloader` if provided (extension-controlled
 *           resolver).
 *        b. Github if `forceGithubDownload` is true.
 *        c. Otherwise: try the bundled Nexus pinned download, fall back to
 *           Github if the version doesn't match what we bundle.
 *
 * The downstream `install()` and `download()` helpers gate themselves on
 * the same "is an injector already installed?" check, with `force=true`
 * bypassing that gate so a forced reinstall actually fires.
 */
import path from "path";
import semver from "semver";
import { actions, fs, log, selectors, types, util } from "vortex-api";

import {
  getDownload,
  getSupportMap,
  MODTYPE_BIX_INJECTOR,
} from "./common";
import {
  IBepInExGameConfig,
  INexusDownloadInfo,
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
  downloadId: string,
) {
  const state = api.getState();
  const download: types.IDownload = util.getSafe(
    state,
    ["persistent", "downloads", "files", downloadId],
    undefined,
  );
  if (download === undefined) {
    throw new util.NotFound(`bepinex download is missing: ${downloadId}`);
  }

  const supportedGames = new Set<string>(
    download.game.concat(Object.keys(getSupportMap())),
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

/**
 * Starts a Nexus download via Vortex's standard `start-download` pipeline
 * using an `nxm://` URL. This path works for both premium and free Nexus
 * users - free users get the usual browser-redirect dialog flow
 * automatically.
 *
 * Returns the new download id on success, or `undefined` when the user
 * cancelled or the fetch failed.
 */
async function startNxmDownload(
  api: types.IExtensionApi,
  downloadInfo: INexusDownloadInfo,
): Promise<string | undefined> {
  const { domainId, modId, fileId, archiveName, gameId } = downloadInfo;

  if (api.ext?.ensureLoggedIn !== undefined) {
    await api.ext.ensureLoggedIn();
  }

  const nxmUrl = `nxm://${domainId}/mods/${modId}/files/${fileId}`;
  const dlInfo = {
    game: gameId,
    source: "nexus",
    name: archiveName,
    nexus: {
      ids: {
        gameId: domainId,
        modId,
        fileId,
      },
    },
  };

  try {
    return await util.toPromise<string>((cb) =>
      api.events.emit(
        "start-download",
        [nxmUrl],
        dlInfo,
        undefined,
        cb,
        undefined,
        { allowInstall: false },
      ),
    );
  } catch (err) {
    if (err instanceof util.UserCanceled) {
      log("info", "user canceled download of BepInEx");
      return undefined;
    }
    log(
      "error",
      "failed to download from NexusMods.com",
      JSON.stringify(downloadInfo, undefined, 2),
    );
    err["attachLogOnReport"] = true;
    api.showErrorNotification("Failed to download BepInEx dependency", err);
    return undefined;
  }
}

async function download(
  api: types.IExtensionApi,
  downloadInfo: INexusDownloadInfo,
  force?: boolean,
): Promise<string | void> {
  // Reuse the archive if it's already staged in Vortex; otherwise fetch it
  // via the standard pipeline.
  const dlId = genDownloadProps(api, downloadInfo.archiveName).downloadId
    ?? await startNxmDownload(api, downloadInfo);
  if (dlId == null) {
    return;
  }

  try {
    updateSupportedGames(api, dlId);
    return install(api, downloadInfo, dlId, force);
  } catch (err) {
    return Promise.reject(err);
  }
}

// Extracts the first MAJOR.MINOR.PATCH triple from a version string and
// ignores anything else (leading "v", trailing ".0" cosmetic padding, "-pre"
// suffixes, BIX 4 segment revisions, etc).
const SEMVER_RE = /(\d+\.\d+\.\d+)/;

function extractSemver(version: string | undefined): string {
  return version?.match(SEMVER_RE)?.[1] ?? "0.0.0";
}

function hasPinnedVersionInstalled(
  mods: { [modId: string]: types.IMod },
  injectorModIds: string[],
  pinnedVersion: string,
): boolean {
  const target = extractSemver(pinnedVersion);
  return injectorModIds.some(
    (id) => extractSemver(mods[id]?.attributes?.version) === target,
  );
}

function getLatestInstalledVersion(
  mods: { [modId: string]: types.IMod },
  injectorModIds: string[],
): string {
  return injectorModIds.reduce((prev, id) => {
    const version = extractSemver(mods[id]?.attributes?.version);
    return semver.gt(version, prev) ? version : prev;
  }, "0.0.0");
}

async function runCustomPackDownloader(
  api: types.IExtensionApi,
  state: types.IState,
  gameId: string,
  gameConf: IBepInExGameConfig,
  force?: boolean,
): Promise<void> {
  let downloadRes: string | INexusDownloadInfo;
  try {
    downloadRes = await gameConf.customPackDownloader!(
      util.getVortexPath("temp"),
    );
    if ((downloadRes as INexusDownloadInfo) !== undefined) {
      await download(api, downloadRes as INexusDownloadInfo, force);
    } else if (typeof downloadRes === "string") {
      if (!path.isAbsolute(downloadRes)) {
        log("error", "failed to download custom pack", "expected absolute path");
      }
      const downloadsPath = selectors.downloadPathForGame(state, gameId);
      await fs.copyAsync(
        downloadRes,
        path.join(downloadsPath, path.basename(downloadRes)),
      );
    } else {
      log("error", "failed to download custom pack", { downloadRes });
    }
  } catch (err) {
    log("error", "failed to download custom pack", err);
  }
}

async function downloadDefaultOrFallback(
  api: types.IExtensionApi,
  gameConf: IBepInExGameConfig,
  force?: boolean,
): Promise<void> {
  const defaultDownload = getDownload(gameConf);
  try {
    if (gameConf.bepinexVersion != null
        && gameConf.bepinexVersion !== defaultDownload.version) {
      // Pinned to a version we don't bundle for Nexus - go to Github instead.
      throw new util.ProcessCanceled("BepInEx version mismatch");
    }
    await download(api, defaultDownload, force);
  } catch {
    await downloadFromGithub(api, gameConf);
  }
}

export async function ensureBepInExPack(
  api: types.IExtensionApi,
  gameMode?: string,
  force?: boolean,
  isUpdate?: boolean,
) {
  const state = api.getState();
  const gameId = gameMode ?? selectors.activeGameId(state);
  const gameConf: IBepInExGameConfig = getSupportMap()[gameId];
  if (gameConf?.autoDownloadBepInEx !== true) {
    return;
  }

  const mods: Record<string, types.IMod> =
    state.persistent.mods[gameId] ?? {};
  const injectorModIds = Object.keys(mods).filter(
    (id) => mods[id]?.type === MODTYPE_BIX_INJECTOR,
  );

  // Pinned-version mode: force a reinstall if no installed injector matches.
  // Skipped when a customPackDownloader is in play - that resolver owns
  // version selection and pinning here would loop on every deploy whenever
  // the downloaded pack's version differs from the pin.
  if (gameConf.bepinexVersion != null
      && gameConf.forceGithubDownload !== true
      && gameConf.customPackDownloader == null
      && !hasPinnedVersionInstalled(mods, injectorModIds, gameConf.bepinexVersion)) {
    force = true;
  }

  // Github-update mode: just look for a newer release and exit.
  if (gameConf.forceGithubDownload === true && isUpdate) {
    const latest = getLatestInstalledVersion(mods, injectorModIds);
    try {
      await checkForUpdates(api, gameConf, latest);
    } catch (err) {
      api.showErrorNotification("Failed to update BepInEx", err);
    }
    return;
  }

  // Already have an injector and not forcing a reinstall - nothing to do.
  if (!force && injectorModIds.length > 0) {
    return;
  }

  if (gameConf.customPackDownloader != null) {
    return runCustomPackDownloader(api, state, gameId, gameConf, force);
  }
  if (gameConf.forceGithubDownload === true) {
    return downloadFromGithub(api, gameConf);
  }
  return downloadDefaultOrFallback(api, gameConf, force);
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
