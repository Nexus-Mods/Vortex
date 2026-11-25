import path from "path";

import { fs, selectors, types, util, VortexGameId } from "@nexusmods/vortex-api";
import Bluebird from "bluebird";

import { downloadBepInExBuild, fetchLatestBepInExBuild } from "./bepinexBuilds";

const GAME_ID = VortexGameId("losteidolons");
const STEAM_APP_ID = "1580520";
const MOD_PATH = path.join("BepInEx", "plugins");

function findGame() {
  return util.GameStoreHelper.findByAppId(STEAM_APP_ID, "steam").then((game) => game.gamePath);
}

function prepareForModding(discovery: types.IDiscoveryResult) {
  if (discovery?.path === undefined) {
    return Bluebird.reject(new util.ProcessCanceled("Game not discovered"));
  }

  return fs.ensureDirWritableAsync(path.join(discovery.path, MOD_PATH));
}

function makeBepInExDownloader(api: types.IExtensionApi) {
  let pendingArchive: { archiveName: string; path: string } | undefined;

  return async (tempDir: string): Promise<string> => {
    const artifact = await fetchLatestBepInExBuild();
    const downloads: Record<string, types.IDownload> =
      api.getState().persistent.downloads.files ?? {};
    const existing = Object.values(downloads).find(
      (download) =>
        download.localPath !== undefined &&
        path.basename(download.localPath) === artifact.archiveName,
    );
    if (existing?.localPath !== undefined) {
      return path.resolve(
        selectors.downloadPathForGame(api.getState(), GAME_ID),
        existing.localPath,
      );
    }

    if (pendingArchive?.archiveName === artifact.archiveName) {
      return pendingArchive.path;
    }

    await fs.ensureDirWritableAsync(tempDir);
    const archivePath = await downloadBepInExBuild(artifact, tempDir);
    pendingArchive = { archiveName: artifact.archiveName, path: archivePath };
    return archivePath;
  };
}

export default function main(context: types.IExtensionContext) {
  context.registerGame({
    id: GAME_ID,
    name: "Lost Eidolons",
    mergeMods: true,
    queryPath: findGame,
    queryArgs: {
      steam: [{ name: "Lost Eidolons" }],
    },
    queryModPath: () => MOD_PATH,
    executable: () => "LostEidolons.exe",
    requiredFiles: ["LostEidolons.exe", "UnityPlayer.dll", "GameAssembly.dll"],
    setup: prepareForModding,
    environment: {
      SteamAPPId: STEAM_APP_ID,
    },
    details: {
      steamAppId: Number(STEAM_APP_ID),
      nexusPageId: "losteidolons",
    },
  });

  context.once(() => {
    if (context.api.ext.bepinexAddGame !== undefined) {
      context.api.ext.bepinexAddGame({
        gameId: GAME_ID,
        autoDownloadBepInEx: true,
        architecture: "x64",
        unityBuild: "unityil2cpp",
        bepinexConfigObject: {
          Logging: {
            UnityLogListening: false,
          },
        },
        customPackDownloader: makeBepInExDownloader(context.api),
        doorstopConfig: {
          doorstopType: "default",
          ignoreDisableSwitch: true,
        },
      });
    }
  });

  return true;
}
