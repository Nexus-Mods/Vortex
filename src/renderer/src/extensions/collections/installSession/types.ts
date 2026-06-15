import type { IModRule, ModState } from "../../mod_management/types/IMod";

/**
 * Status of an individual mod within a collection installation.
 *
 * The live states are picked explicitly from a mod's ModState (the `keyof Pick<...>`):
 * picking a value that isn't a ModState is a compile error so the two can't drift, while
 * a newly added ModState is NOT silently absorbed. The rest are collection-only lifecycle
 * states with no IMod equivalent.
 */
export type CollectionModStatus =
  | keyof Pick<Record<ModState, true>, "downloading" | "downloaded" | "installing" | "installed">
  | "pending" // not yet processed
  // installation failed. NOTE: not yet wired up - the UI renders this status but nothing
  // sets it on the session yet, so a failed mod currently surfaces as "pending" rather
  // than "failed". The install-failure path still needs to call updateModTracking(rule,
  // "failed").
  | "failed"
  | "ignored" // excluded by user choice (skipped during install or manually ignored)
  | "optional"; // optional mod not selected

/**
 * Information about a mod's installation within a collection
 */
export interface ICollectionModInstallInfo {
  /** The mod rule that defines this dependency */
  rule: IModRule;
  /** Current status of this mod */
  status: CollectionModStatus;
  /** The installed mod reference (if installed) */
  modId?: string;
  /** Whether this is a required or optional mod */
  type: "requires" | "recommends";
  /** Installation phase for ordering */
  phase?: number;
}

/**
 * Overall collection installation session information
 */
export interface ICollectionInstallSession {
  /** Unique session ID */
  sessionId: string;
  /** The collection mod being installed */
  collectionId: string;
  /** Profile ID where collection is being installed */
  profileId: string;
  /** Game ID */
  gameId: string;
  /** Map of mod rule IDs to their installation info */
  mods: { [ruleId: string]: ICollectionModInstallInfo };
  /** Total number of required mods */
  totalRequired: number;
  /** Total number of optional mods */
  totalOptional: number;
  /** Number of mods successfully downloaded */
  downloadedCount: number;
  /** Number of mods successfully installed */
  installedCount: number;
  /** Number of mods that failed to install */
  failedCount: number;
  /** Number of optional mods skipped */
  ignoredCount: number;
}

export interface ICollectionInstallState {
  /** Current active installation session (if any) */
  activeSession?: ICollectionInstallSession;
  /** ID of the last completed installation session */
  lastActiveSessionId?: string;
  /** History of completed/failed installation sessions */
  sessionHistory: { [sessionId: string]: ICollectionInstallSession };
}
