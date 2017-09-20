import {IDeployedFile} from './IModActivator';

export interface IDeploymentManifest {
  version: number;
  instance: string;
  files: IDeployedFile[];
}

export type ManifestFormat = (input: any) => IDeploymentManifest;
