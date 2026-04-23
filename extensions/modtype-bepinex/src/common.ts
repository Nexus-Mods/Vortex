import path from "path";
import {
  IBIXPackageResolver,
  IAvailableDownloads,
  IBepInExGameConfig,
  INexusDownloadInfoExt,
} from "./types";
import { util } from "vortex-api";

import semver from "semver";
export const NEXUS = "www.nexusmods.com";
export const DOORSTOPPER_HOOK = "winhttp.dll";
export const DOORSTOPPER_CONFIG = "doorstop_config.ini";
export const BEPINEX_CONFIG_FILE = "BepInEx.cfg";
export const BEPINEX_CONFIG_REL_PATH = path.join(
  "BepInEx",
  "config",
  BEPINEX_CONFIG_FILE,
);
export const DOORSTOP_FILES: string[] = [DOORSTOPPER_CONFIG, DOORSTOPPER_HOOK];
export const INJECTOR_FILES: string[] = [
  "0Harmony.dll",
  "0Harmony.xml",
  "0Harmony20.dll",
  "BepInEx.dll",
  "BepInEx.Core.dll",
  "BepInEx.Preloader.Core.dll",
  "BepInEx.Preloader.Unity.dll",
  "BepInEx.Harmony.dll",
  "BepInEx.Harmony.xml",
  "BepInEx.Preloader.dll",
  "BepInEx.Preloader.xml",
  "BepInEx.xml",
  "HarmonyXInterop.dll",
  "Mono.Cecil.dll",
  "Mono.Cecil.Mdb.dll",
  "Mono.Cecil.Pdb.dll",
  "Mono.Cecil.Rocks.dll",
  "MonoMod.RuntimeDetour.dll",
  "MonoMod.RuntimeDetour.xml",
  "MonoMod.Utils.dll",
  "MonoMod.Utils.xml",
];

export const MODTYPE_BIX_INJECTOR = "bepinex-injector";

const DEFAULT_VERSION = "5.4.22";
const NEW_FILE_FORMAT_VERSION = "6.0.0";
const GAME_SUPPORT: { [gameId: string]: IBepInExGameConfig } = {};
export const getSupportMap = () => GAME_SUPPORT;
export const resolveBixPackage = (
  gameConf: IBepInExGameConfig,
): IBIXPackageResolver => {
  // Depending on the game config's github parameters this will generate a regexp
  //  that will match the download link for the BepInEx package.
  const { architecture, bepinexVersion, bepinexCoercedVersion, unityBuild } =
    gameConf;
  const arch = architecture !== undefined ? architecture : "x64";
  const version =
    bepinexCoercedVersion !== undefined
      ? bepinexCoercedVersion
      : DEFAULT_VERSION;
  const platform = semver.gte(version.replace(/-.*$/gim, ""), "5.4.23")
    ? process.platform === "win32"
      ? "win_"
      : "linux_"
    : "";
  const unity =
    unityBuild !== undefined
      ? semver.gte(version, NEW_FILE_FORMAT_VERSION)
        ? `${unityBuild}_`
        : ""
      : semver.gte(version, NEW_FILE_FORMAT_VERSION)
        ? "unitymono_"
        : "";
  const regex = `BepInEx_${platform}${unity}${arch}_${bepinexVersion}.*[.zip|.7z]`;
  return {
    rgx: new RegExp(regex, "i"),
    version,
    architecture: arch,
    unityBuild,
  };
};

export const addGameSupport = (gameConf: IBepInExGameConfig) => {
  const isIL2CPP = gameConf.unityBuild === "unityil2cpp";

  if (isIL2CPP
      && gameConf.bepinexVersion != null
      && semver.lt(gameConf.bepinexVersion, "6.0.0")) {
    throw new Error("IL2CPP builds require BepInEx 6.0.0 or above");
  }

  // Pick a default version when the extension hasn't pinned one. IL2CPP needs
  //  6.0.0+; otherwise we use DEFAULT_VERSION - but only when the extension
  //  isn't delegating version selection to a customPackDownloader (pinning in
  //  that case forces a reinstall on every deploy whenever the downloaded
  //  pack's version differs from DEFAULT_VERSION).
  if (gameConf.bepinexVersion == null) {
    if (isIL2CPP) {
      gameConf.bepinexVersion = "6.0.0";
    } else if (gameConf.customPackDownloader === undefined) {
      gameConf.bepinexVersion = DEFAULT_VERSION;
    }
  }

  if (gameConf.bepinexVersion != null) {
    gameConf.bepinexCoercedVersion =
      util.semverCoerce(gameConf.bepinexVersion).version;
  }

  GAME_SUPPORT[gameConf.gameId] = gameConf;
};

const AVAILABLE: IAvailableDownloads = {
  "5.4.10x64": {
    architecture: "x64",
    domainId: "site",
    version: "5.4.10",
    modId: 115,
    fileId: 1023,
    archiveName: "BepInEx_x64_5.4.10.0.zip",
    allowAutoInstall: true,
    githubUrl: "https://github.com/BepInEx/BepInEx/releases/tag/v5.4.10",
  },
  "5.4.13x64": {
    architecture: "x64",
    domainId: "site",
    version: "5.4.13",
    modId: 115,
    fileId: 1137,
    archiveName: "BepInEx_x64_5.4.13.0.zip",
    allowAutoInstall: true,
    githubUrl: "https://github.com/BepInEx/BepInEx/releases/tag/v5.4.13",
  },
  "5.4.15x64": {
    architecture: "x64",
    domainId: "site",
    version: "5.4.15",
    modId: 115,
    fileId: 1175,
    archiveName: "BepInEx_x64_5.4.15.0.zip",
    allowAutoInstall: true,
    githubUrl: "https://github.com/BepInEx/BepInEx/releases/tag/v5.4.15",
  },
  "5.4.17x64": {
    architecture: "x64",
    domainId: "site",
    version: "5.4.17",
    modId: 115,
    fileId: 1273,
    archiveName: "BepInEx_x64_5.4.17.0.zip",
    allowAutoInstall: true,
    githubUrl: "https://github.com/BepInEx/BepInEx/releases/tag/v5.4.17",
  },
  "5.4.22x86": {
    architecture: "x86",
    domainId: "site",
    version: "5.4.22",
    modId: 115,
    fileId: 2528,
    archiveName: "BepInEx_x86_5.4.22.0.zip",
    allowAutoInstall: true,
    githubUrl: "https://github.com/BepInEx/BepInEx/releases/tag/v5.4.22",
  },
  "5.4.22x64": {
    architecture: "x64",
    domainId: "site",
    version: "5.4.22",
    modId: 115,
    fileId: 2526,
    archiveName: "BepInEx_x64_5.4.22.0.zip",
    allowAutoInstall: true,
    githubUrl: "https://github.com/BepInEx/BepInEx/releases/tag/v5.4.22",
  },
};

const getLatestVersion = (arch: string): string => {
  const versions = Object.values(AVAILABLE);
  const latestVersion = versions.reduce((prev, iter) => {
    if (semver.gt(iter.version, prev)) {
      prev = iter.version;
    }
    return prev;
  }, DEFAULT_VERSION);
  return `${latestVersion}${arch}`;
};

export const getDownload = (
  gameConf: IBepInExGameConfig,
): INexusDownloadInfoExt => {
  const arch = gameConf.architecture ?? "x64";
  const versionKey = `${gameConf.bepinexVersion}${arch}`;
  const download: INexusDownloadInfoExt =
    gameConf.bepinexVersion != null &&
      Object.keys(AVAILABLE).includes(versionKey)
      ? AVAILABLE[versionKey]
      : AVAILABLE[getLatestVersion(arch)];
  return {
    ...download,
    gameId: gameConf.gameId,
  };
};
