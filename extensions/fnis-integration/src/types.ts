import { types } from "@nexusmods/vortex-api";

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

export interface IFNISSettings {
  autoRun: boolean;
  /** ids of the enabled patches, per profile */
  patches: { [profileId: string]: string[] };
  needToRun: { [profileId: string]: boolean };
}

declare module "@nexusmods/vortex-api" {
  namespace types {
    interface ISettings {
      fnis: IFNISSettings;
    }
  }
}
