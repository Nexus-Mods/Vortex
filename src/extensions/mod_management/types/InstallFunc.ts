import {IInstallResult} from './IInstallResult';

import * as Promise from 'bluebird';

export type ProgressDelegate = (perc: number) => void;

export type InstallFunc =
    (files: string[], destinationPath: string, gameId: string,
     progressDelegate: ProgressDelegate, choices?: any) => Promise<IInstallResult>;
