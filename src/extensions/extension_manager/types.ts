import {IExtensionLoadFailure, IExtensionState} from '../../types/IState';

export type ExtensionType = 'game' | 'translation' | 'theme';

export interface IExtension {
  name: string;
  author: string;
  description: string;
  version: string;
  type?: ExtensionType;
  bundled?: boolean;
  path?: string;
}

export type IExtensionWithState = IExtension & IExtensionState & {
  loadFailures: IExtensionLoadFailure[];
};

export interface IExtensionDownloadInfo {
  name: string;
  modId: number;
  fileId: number;
}

export interface IAvailableExtension extends IExtensionDownloadInfo {
  description: {
    short: string;
    long: string;
  };
  type?: ExtensionType;
  language?: string;
  image: string;
  author: string;
  version: string;
  downloads: number;
  endorsements: number;
  tags: string[];
}

