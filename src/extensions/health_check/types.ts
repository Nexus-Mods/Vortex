/**
 * Health check extension types
 */

import type {
  HealthCheckTrigger,
  IHealthCheckResult,
} from "../../types/IHealthCheck";
import type {
  ICustomCheckApi,
  ILegacyApi,
  IPredefinedCheckApi,
  IResultsApi,
} from "./api";

/**
 * Known health check IDs (both custom and predefined)
 */
export type HealthCheckId = "check-nexus-mod-requirements";

/**
 * Predefined check IDs (subset of HealthCheckId that run in main process)
 */
export type PredefinedCheckId = Extract<
  HealthCheckId,
  "check-nexus-mod-requirements"
>;

/**
 * A required mod that is missing
 */
export interface IMissingRequiredMod {
  /** Nexus mod ID of the required mod */
  nexusModId: number;
  /** Display name of the required mod */
  name: string;
  /** Optional notes from the mod author about this requirement */
  notes?: string;
  /** URL to the required mod on Nexus */
  nexusUrl?: string;
  /** Latest available file ID for the required mod */
  latestMainFileId?: number;
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
  /** Nexus mod ID */
  nexusModId: number;
  /** Display name of the mod */
  modName: string;
  /** List of missing mod requirements */
  missingMods: IMissingRequiredMod[];
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
  /** Custom health checks (renderer process) */
  custom: ICustomCheckApi;

  /** Predefined checks (main process) */
  predefined: IPredefinedCheckApi;

  /** Legacy test adapter */
  legacy: ILegacyApi;

  /** Results management */
  results: IResultsApi;

  /** Run all checks (custom + predefined) */
  runAll: () => Promise<IHealthCheckResult[]>;

  /** Run checks by trigger type */
  runChecksByTrigger?: (
    trigger: HealthCheckTrigger,
  ) => Promise<IHealthCheckResult[]>;
}
