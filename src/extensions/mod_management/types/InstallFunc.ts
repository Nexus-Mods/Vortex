import {IInstallResult} from './IInstallResult';

// TODO: Remove Bluebird import - using native Promise;

export type ProgressDelegate = (perc: number) => void;

export type InstallFunc =
    (files: string[], destinationPath: string, gameId: string,
     progressDelegate: ProgressDelegate, choices?: any,
     unattended?: boolean, archivePath?: string) => Promise<IInstallResult>;
