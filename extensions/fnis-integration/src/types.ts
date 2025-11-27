import { types } from 'vortex-api';

export interface IDeployment {
  [modType: string]: types.IDeployedFile[];
}

export interface IFNISPatch {
  id: string;
  hidden: boolean;
  numBones: number;
  requiredBehaviorsPattern: string;
  description: string;
  requiredFile: string;
}
