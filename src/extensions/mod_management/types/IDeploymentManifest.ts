import {IDeployedFile} from './IDeploymentMethod';

export interface IDeploymentManifest {
  version: number;
  instance: string;
  deploymentMethod?: string;
  files: IDeployedFile[];
}

export type ManifestFormat = (input: any) => IDeploymentManifest;
