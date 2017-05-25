import * as Promise from 'bluebird';

export type IProgressDelegate = (perc: number) => void;

export type IInstall = (files: string[], destinationPath: string,
                        gameId: string, progressDelegate: IProgressDelegate) => Promise<any>;
