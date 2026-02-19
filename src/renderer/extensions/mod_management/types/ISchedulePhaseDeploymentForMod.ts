import type { IModReference } from "./IMod";

/**
 * Thanks to the headless installer, we can now proceed with mod installations
 *  without deploying them right away. Unfortunately this only works when a
 *  preset is provided - manual UI-based installations still need phased
 *  deployments for all relevant options as intended by the curator to be
 *  available.
 */
export interface ISchedulePhaseDeploymentForMod {
  /** The ID of the mod being deployed */
  modId: string;
  /** The game ID where the mod is being deployed */
  gameId: string;
  /** The path to the mod archive (if applicable) */
  archivePath?: string;
  /** The reference information for the mod being installed */
  modReference?: IModReference;
}
