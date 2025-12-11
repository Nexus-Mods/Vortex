import { IModRule } from "../../types/api";

/**
 * Status of an individual mod within a collection installation
 */
export type CollectionModStatus =
  | "pending" // Not yet processed
  | "downloading" // Currently downloading
  | "downloaded" // Downloaded but not installed
  | "installing" // Currently being installed
  | "installed" // Successfully installed
  | "failed" // Installation failed
  | "skipped" // Skipped by user choice
  | "optional"; // Optional mod not selected

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
  skippedCount: number;
}

export interface ICollectionInstallState {
  /** Current active installation session (if any) */
  activeSession?: ICollectionInstallSession;
  /** ID of the last completed installation session */
  lastActiveSessionId?: string;
  /** History of completed/failed installation sessions */
  sessionHistory: { [sessionId: string]: ICollectionInstallSession };
}
