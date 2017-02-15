import * as Promise from 'bluebird';

export interface IProgressDelegate {
  (perc: number): void;
}

export interface IInstall {
  (files: string[], destinationPath: string, gameId: string,
   progressDelegate: IProgressDelegate): Promise<any>;
}
