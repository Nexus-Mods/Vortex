import { types } from "vortex-api";

export type UnityDoorstopType = "none" | "default" | "unity3";

export class NotPremiumError extends Error {
  constructor() {
    super("User is not premium");
    this.name = "NotPremiumError";
  }
}

export interface IDoorstopConfig {
  // Depending on the game's modding pattern, the doorstop assembly
  //  can be installed as winhttp.dll, version.dll or not at all; winhttp.dll
  //  will generally work for all Unity games, but version.dll appears to be
  //  more functional when used with unity3 games.
  doorstopType: UnityDoorstopType;

  // Relative/Absolute path to the target assembly, by default this will be set
  //  to BepInEx's preloader.
  targetAssembly?: string;

  // Will ignore the DOORSTOP_DISABLE environment variable if set to true.
  ignoreDisableSwitch?: boolean;

  // This refers to the game's unity log; if set to true the log will be redirected
  //  to the folder where the doorstop assembly is located ../output_log.txt
  redirectOutputLog?: boolean;

  // Relative path to the game's mono/unity dependencies. This is useful
  //  if the game's assemblies are optimised/have functionality stripped.
  dllOverrideRelPath?: string;

  // Some game extensions may want to validate the doorstop's configuration
  //  or assembly version, etc. This test will be kicked off on extension activation.
  validateDoorStopConfig?: (
    doorStopAssemblyPath: string,
  ) => Promise<types.ITestResult>;
}

export interface IGithubAsset {
  name: string;
  browser_download_url: string;
}

export interface IGithubRelease {
  tag_name: string;
  assets: IGithubAsset[];
}

export type BepInExArchitecture = "x86" | "x64" | "unix";
export type BepInExUnityBuild = "unitymono" | "unityil2cpp";
export interface IBIXPackageResolver {
  rgx: RegExp;
  version: string; // Semver
  architecture: BepInExArchitecture;
  unityBuild?: BepInExUnityBuild;
}

export interface IBepInExGameConfig {
  // Nexus Mods GameId.
  gameId: string;

  // We're able to auto download the BepInEx package
  autoDownloadBepInEx: boolean;

  // Whether Vortex should bypass Nexus Mods by default and try
  //  to download from Github directly - this property works in unison
  //  with the below "bepinexVersion" property when attempting to resolve
  //  which BIX version to use. If "bepinexVersion" isn't defined - the
  //  downloader will always attempt to update to the latest available release
  //  on Github.
  forceGithubDownload?: boolean;

  // The architecture of the game we're modding.
  architecture?: BepInExArchitecture;

  // The unity build of the BepInEx package (mono or il2cpp).
  //  Please note that using il2cpp will force this extension to resolve
  //  to 6.0.0 =< versions.
  unityBuild?: BepInExUnityBuild;

  // The required BepInEx version to use with this game
  //  (USE SEMANTIC VERSIONING i.e. '5.4.10'). This should only be
  //  used if/when the latest available version does not function correctly
  //  with the game. Note that if specified, Vortex will ALWAYS ensure that this
  //  version is downloaded and installed).
  //  IMPORTANT - The Nexus Mods website does _not_ host all BepInEx
  //  versions and only a select few are available to automatically download,
  //  available versions can be seen here:
  //  https://github.com/Nexus-Mods/extension-modtype-bepinex/blob/main/src/common.ts
  //
  // If the required version is not available, please use the customPackDownloader
  //  functor (optional property - see below) to download and have Vortex install it
  //  as a mod.
  bepinexVersion?: string;

  // Used internally to store the coerced version of this BepInEx pack.
  bepinexCoercedVersion?: string;

  // The game extension can have its own BepInEx configuration object defined
  //  this will be used to generate the BepInEx configuration file when installing
  //  the package. See the documentation for available parameters
  //  https://docs.bepinex.dev/articles/user_guide/configuration.html
  //
  // IMPORTANT - ".cfg" files use the TOML format, please ensure that the object
  //  you provide is valid TOML.
  // ALTERNATIVELY - You can provide a BepInEx.cfg file alongside your extension
  //  and it will be used instead of the object. (The object has priority though!)
  bepinexConfigObject?: any;

  // Relative path to the game's root directory where
  //  the game extension requires the BepInEx folder to be
  //  deployed to. Generally this should never have to be used
  //  as long as the game executable is located at the game's root path.
  installRelPath?: string;

  // Gives the game extension the ability to configure the Unity Doorstop mechanism.
  //  Default values are used if this property is not defined.
  doorstopConfig?: IDoorstopConfig;

  // The game extension can have its own downloader code defined if the default
  //  BepInEx package is not compatible with the game. This functor expects
  //  the extension to return the path to the archive (7z, rar, zip) containing
  //  the BepInEx package; OR the NexusMods file details required to download the pack
  //  from the website. The vortexTempDirPath property will provide the user
  //  with a suggested location where the archive should/could be created without
  //  fearing permissions related issues (hopefully)
  customPackDownloader?: (
    vortexTempDirPath: string,
  ) => Promise<string | INexusDownloadInfo>;

  // Allows the game extension to validate the bepinex configuration/installation
  //  and inform the user if something is off. This test will be kicked off on
  //  extension activation.
  validateBepInExConfiguration?: (
    bepinexPath: string,
  ) => Promise<types.ITestResult>;
}

export interface INexusDownloadInfoExt extends INexusDownloadInfo {
  githubUrl: string;
}
export interface INexusDownloadInfo {
  // Refers to the domain of the package which is usually just a gameId unless 'site'
  //  is used instead.
  domainId: string;

  // The game we're downloading the file for - used to install the BepInEx package
  //  as soon as we finish downloading it (when auto installation is enabled)
  gameId?: string;

  // The mod's version, this can usually be "guessed" using the file's name.
  version: string;

  // x86 or x64
  architecture: BepInExArchitecture;

  // The numerical id of the mod.
  modId: string;

  // The id of the specific file we want to download.
  fileId: string;

  // The name of the archive including its extension (i.e. '.zip', '.7z', etc).
  archiveName: string;

  // Whether we're ok to have the download automatically install when download
  //  completes.
  allowAutoInstall?: boolean;
}

export interface IAvailableDownloads {
  [version: string]: INexusDownloadInfoExt;
}
