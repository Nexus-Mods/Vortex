export interface IUMMGameConfig {
  gameId: string;
  autoDownloadUMM: boolean;
  ummVersion?: string;
}

export interface INexusDownloadInfo {
  // Refers to the domain of the package which is usually just a gameId unless 'site'
  //  is used instead.
  domainId: string;

  // The game we're downloading the file for - used to install the BepInEx package
  //  as soon as we finish downloading it (when auto installation is enabled)
  gameId?: string;

  // The numerical id of the mod.
  modId: string;

  // The id of the specific file we want to download.
  fileId: string;

  // The name of the archive including its extension (i.e. '.zip', '.7z', etc).
  archiveName: string;

  // Whether we we're ok to have the download automatically install when download
  //  completes.
  allowAutoInstall?: boolean;

  githubUrl: string;
}

export interface ISchemaViolation {
  message: string;
}

export interface IAvailableDownloads {
  [version: string]: INexusDownloadInfo;
}
