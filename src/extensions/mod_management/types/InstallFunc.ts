import {IInstallResult} from './IInstallResult';

import Promise from 'bluebird';

export type ProgressDelegate = (perc: number) => void;
export interface IInstallationDetails {
  // At time of writing, this is primarily used to avoid using stop patterns
  //  when instructions are being overridden by an instructions override file.
  hasInstructionsOverrideFile: boolean
}

export type InstallFunc =
    (files: string[], destinationPath: string, gameId: string,
     progressDelegate: ProgressDelegate, choices?: any,
     unattended?: boolean, archivePath?: string, options?: IInstallationDetails) => Promise<IInstallResult>;
