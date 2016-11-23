import * as Promise from 'bluebird';

export interface IProgressDelegate {
  (perc: number): void;
}

export interface IInstall {
  (files: string[], destinationPath: string,
   progressDelegate: IProgressDelegate): Promise<any>;
}
