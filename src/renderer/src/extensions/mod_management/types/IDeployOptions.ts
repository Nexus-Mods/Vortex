export interface IDeployOptions {
  manual?: boolean;
  isCollectionPostprocessCall?: boolean;
  /** the deploy-mods callback receives a failed deployment's error */
  failOnError?: boolean;
}
