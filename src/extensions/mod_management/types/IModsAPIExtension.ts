
export interface IModsAPIExtension {
  awaitNextPhaseDeployment?: () => Promise<void>;
}
