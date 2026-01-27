/**
 * Health check extension types
 */

import type { IModRequiring, IModRequirement } from "@nexusmods/nexus-api";
import type {
  HealthCheckTrigger,
  IHealthCheckResult,
} from "../../types/IHealthCheck";
import type { ICustomCheckApi, ILegacyApi, IResultsApi } from "./api";

/**
 * Known health check IDs
 */
export type HealthCheckId = "check-nexus-mod-requirements";

/**
 * A subset of IModRequiring representing the mod that requires a missing mod.
 * Picks only modId and modName, and converts modId to number.
 */
export type RequiringMod = Omit<
  Pick<IModRequiring, "modId" | "modName">,
  "modId"
> & {
  modId: number;
  modUrl: string;
};

/**
 * A required mod that is missing
 */
export interface IModRequirementExt
  extends Omit<IModRequirement, "modId" | "gameId"> {
  /** Unique DB identifier */
  uid: string;
  /** The mod that requires this mod */
  requiredBy: RequiringMod;
  /** Nexus mod ID as number */
  modId: number;
  /** Nexus game domain ID */
  gameId: string;
  /** Url to view mod information */
  modUrl: string;
}

/**
 * Nexus mod file category IDs
 */
export enum ModFileCategory {
  Main = 1,
  Update = 2,
  Optional = 3,
  OldVersion = 4,
  Miscellaneous = 5,
  Deleted = 6,
  Archived = 7,
}

/**
 * File information for a mod from Nexus
 */
export interface IModFileInfo {
  /** File ID on Nexus */
  fileId: number;
  /** Mod ID on Nexus */
  modId: number;
  /** Nexus game domain ID */
  gameId: string;
  /** File name */
  name: string;
  /** File version */
  version: string;
  /** File category (main, update, optional, etc.) */
  category: ModFileCategory;
  /** Category display name */
  categoryName: string;
  /** File description */
  description: string;
  /** File size in bytes */
  size: number;
  /** Upload timestamp */
  uploadedTimestamp: number;
  /** Whether this is the primary/recommended file */
  isPrimary: boolean;
  /** Thumbnail URL if available */
  thumbnailUrl?: string;
}

/**
 * A required DLC that may be missing
 */
export interface IMissingRequiredDlc {
  /** Name of the required DLC/expansion */
  name: string;
  /** DLC ID if available (string from Nexus API) */
  dlcId?: string;
  /** Optional notes from the mod author */
  notes?: string;
}

/**
 * Requirements info for a single mod that has missing dependencies
 */
export interface IModMissingRequirements {
  /** Vortex mod ID */
  modId: string;
  /** Nexus game domain ID */
  gameId: string;
  /** Nexus mod ID */
  nexusModId: number;
  /** Display name of the mod */
  modName: string;
  /** List of missing mod requirements */
  missingMods: IModRequirementExt[];
  /** List of DLC requirements (informational, cannot be auto-verified) */
  dlcRequirements: IMissingRequiredDlc[];
}

/**
 * Parameters for the check-nexus-mod-requirements check
 */
export interface IModRequirementsCheckParams {
  /** Skip API calls and only use cached requirements data */
  cachedOnly?: boolean;
  /** Limit the number of mods to check */
  limit?: number;
}

/**
 * Metadata for the mod requirements health check result
 */
export interface IModRequirementsCheckMetadata {
  /** Game ID this check was run for */
  gameId: string;
  /** Total number of mods checked */
  modsChecked: number;
  /** Number of mods that had requirements fetched from API (not cached) */
  modsFetched: number;
  /** Map of Vortex mod ID to its missing requirements */
  modRequirements: { [modId: string]: IModMissingRequirements };
  /** Any errors encountered during the check */
  errors: string[];
}

/**
 * Complete Health Check API
 * Organized into separate namespaces for different functionality
 */
export interface IHealthCheckApi {
  /** Custom health checks */
  custom: ICustomCheckApi;

  /** Legacy test adapter */
  legacy: ILegacyApi;

  /** Results management */
  results: IResultsApi;

  /** Run all health checks */
  runAll: () => Promise<IHealthCheckResult[]>;

  /** Run checks by trigger type */
  runChecksByTrigger?: (
    trigger: HealthCheckTrigger,
  ) => Promise<IHealthCheckResult[]>;
}
