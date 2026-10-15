export interface IDeployOptions {
  manual?: boolean;
  profileId?: string;
  isCollectionPostprocessCall?: boolean;
  /** the deploy-mods callback receives a failed deployment's error */
  failOnError?: boolean;
}
