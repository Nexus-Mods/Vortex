import {IExtensionLoadFailure, IExtensionState} from '../../types/IState';

export type ExtensionType = 'game' | 'translation' | 'theme';

/**
 * Information about an extension available from the info.json file
 */
export interface IExtension {
  // id of the extension. We strongly advice against setting this manually
  // in info.json because it mustn't be changed once the extension is released.
  // if this isn't set, Vortex will assign something automatically that at least
  // doesn't change on a users system after the extension is installed
  id?: string;
  // namespace. This is used (for example) to identify the localization for
  // the extension. Unlike the id there isn't really a problem if this gets
  // changed after release except you may ruin the day for translators.
  // if this is unset but the id isn't, uses the id, otherwise something is
  // derived from the extension name
  namespace?: string;
  name: string;
  author: string;
  description: string;
  version: string;
  type?: ExtensionType;
  bundled?: boolean;
  path?: string;
  modId?: number;
  issueTrackerURL?: string;
}

export type IExtensionWithState = IExtension & IExtensionState & {
  loadFailures: IExtensionLoadFailure[];
};

export interface IExtensionDownloadInfo {
  name: string;
  modId?: number;
  fileId?: number;
  github?: string;
  githubRawPath?: string;
  githubRelease?: string;
}

/**
 * information about an extension available on the central extension list
 */
export interface IAvailableExtension extends IExtensionDownloadInfo {
  description: {
    short: string;
    long: string;
  };
  id?: string;
  type?: ExtensionType;
  language?: string;
  gameName?: string;
  gameId?: string;
  image: string;
  author: string;
  uploader: string;
  version: string;
  downloads: number;
  endorsements: number;
  timestamp: number;
  tags: string[];
  dependencies?: { [key: string]: any };
  hide?: boolean;
}

export interface IExtensionManifest {
  last_updated: number;
  extensions: IAvailableExtension[];
}

export interface ISelector {
  modId: number;
  github: string;
  githubRawPath: string;
}
