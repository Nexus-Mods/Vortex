import { IDeployOptions } from "./IDeployOptions";

export interface IModsAPIExtension {
  // Await the deployment of mods for the next phase in an active collection installation
  awaitNextPhaseDeployment?: () => Promise<void>;

  // Await the deployment of mods for the specified profile
  awaitModsDeployment?: (
    profileId?: string,
    progressCB?: (text: string, percent: number) => void,
    deployOptions?: IDeployOptions,
  ) => Promise<void>;
}
