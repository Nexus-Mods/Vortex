import semver from "semver";
import {
  IAvailableDownloads,
  INexusDownloadInfo,
  IUMMGameConfig,
} from "./types";

export const NEXUS = "www.nexusmods.com";
export const UMM_EXE = "UnityModManager.exe";
export const UMM_ID = "UnityModManager";

const GAME_SUPPORT: { [gameId: string]: IUMMGameConfig } = {};
export const getSupportMap = () => GAME_SUPPORT;
export const addGameSupport = (gameConf: IUMMGameConfig) => {
  GAME_SUPPORT[gameConf.gameId] = gameConf;
};

const DEFAULT_VERSION = "0.24.2";
const AVAILABLE: IAvailableDownloads = {
  "0.21.8-b": {
    domainId: "site",
    modId: "21",
    fileId: "484",
    archiveName: "UnityModManager-21-0-21-8b.zip",
    allowAutoInstall: true,
    githubUrl: "https://github.com/IDCs/unity-mod-manager/releases/tag/0.21.8b",
  },
  "0.23.5-b": {
    domainId: "site",
    modId: "21",
    fileId: "1180",
    archiveName: "UnityModManager-21-0-23-5b.zip",
    allowAutoInstall: true,
    githubUrl: "https://github.com/IDCs/unity-mod-manager/releases/tag/0.23.5b",
  },
  "0.24.2": {
    domainId: "site",
    modId: "21",
    fileId: "1359",
    archiveName: "UnityModManager-21-0-24-2.zip",
    allowAutoInstall: true,
    githubUrl: "https://github.com/IDCs/unity-mod-manager/releases/tag/0.24.2",
  },
};

export const getLatestVersion = (): string => {
  const versions = Object.keys(AVAILABLE);
  const latestVersion = versions.reduce((prev, iter) => {
    if (semver.gt(iter, prev)) {
      prev = iter;
    }
    return prev;
  }, DEFAULT_VERSION);
  return latestVersion;
};

export const getDownload = (gameConf: IUMMGameConfig): INexusDownloadInfo => {
  const download: INexusDownloadInfo =
    gameConf.ummVersion !== undefined &&
    Object.keys(AVAILABLE).includes(gameConf.ummVersion)
      ? AVAILABLE[gameConf.ummVersion]
      : AVAILABLE[getLatestVersion()];
  return {
    ...download,
    gameId: gameConf.gameId,
  };
};
