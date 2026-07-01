/**
 * Health check extension types
 */

import type { IModRequiring, IModRequirement } from "@nexusmods/nexus-api";

import type { HealthCheckTrigger, IHealthCheckResult } from "../../types/IHealthCheck";
import type { ICustomCheckApi, ILegacyApi, IResultsApi } from "./api";

/**
 * Known health check IDs
 */
export type HealthCheckId = "check-nexus-mod-requirements" | "check-file-level-requirements";

/**
 * A subset of IModRequiring representing the mod that requires a missing mod.
 * Picks only modId and modName, and converts modId to number.
 */
export type RequiringMod = Omit<Pick<IModRequiring, "modId" | "modName">, "modId"> & {
  modId: number;
  modUrl?: string;
};

/**
 * A required mod that is missing
 */
export interface IModRequirementExt extends Omit<IModRequirement, "modId" | "gameId"> {
  /** Unique DB identifier */
  uid: string;
  /** The mod that requires this mod */
  requiredBy: RequiringMod;
  /** Nexus mod ID as number */
  modId: number;
  /** Nexus game domain ID */
  gameId: string;
  /** Url to view mod information; undefined if no URL could be derived (e.g., game has no Nexus domain mapping) */
  modUrl?: string;
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
  /** Mod-level detail, denormalized onto each file (like thumbnailUrl): adult-content flag. */
  adultContent?: boolean;
  /** Mod-level detail, denormalized onto each file (like thumbnailUrl): mod summary. */
  modSummary?: string;
}

/**
 * Minimal mod details used by the health checks (mod-level requirement listing
 * and file-level requirement candidates). Sourced from the batched modsByUid
 * GraphQL query.
 */
export interface IModDetails {
  /** Composite mod UID (game + mod id) */
  modUID: string;
  /** Display name of the mod */
  modName: string;
  /** Mod summary */
  modSummary?: string;
  /** Thumbnail URL if available */
  thumbnailUrl?: string;
  /** Whether the mod is flagged as adult content */
  adultContent: boolean;
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
 * A downloadable file the user can fetch to satisfy a requirement
 */
export interface IFileRequirementCandidate {
  /** Composite id for the file version (game-scoped fileId combined with the game id) */
  fileUID: string;
  /** Composite id for the mod (game-scoped modId combined with the game id) */
  modUID: string;
  /** Display name of the mod */
  modName: string;
  /** Mod summary */
  modSummary?: string;
  /** Thumbnail URL if available */
  thumbnailUrl?: string;
  /** File name */
  fileName: string;
  /** File version */
  version: string;
  /** Whether the mod is flagged as adult content */
  adultContent: boolean;
}

/**
 * A file the user already has installed (a Vortex mod)
 */
export interface IInstalledFile {
  /** Vortex mod id (key into persistent.mods and profile.modState) */
  modId: string;
  /** Composite id for the file version (game-scoped fileId combined with the game id) */
  fileUID: string;
  /** Composite id for the mod (game-scoped modId combined with the game id) */
  modUID: string;
  /** Display name of the mod */
  modName: string;
  /** Thumbnail URL if available */
  thumbnailUrl?: string;
  /** File name */
  fileName: string;
  /** File version */
  version: string;
  /** Whether the mod is flagged as adult content */
  adultContent: boolean;
  /** Whether this file is currently enabled in the active profile */
  enabled: boolean;
}

/**
 * Report category for a source file's unsatisfied dependencies. Each category
 * groups homogeneous requirements with their own copy, buttons and detail layout;
 * a single source file can surface several categories at once. Maps 1:1 onto the
 * IFileRequirement kinds via `categoryOf` in the content module.
 */
export type FileRequirementCategory =
  /** Missing: download (and install) a file. No user choice needed. */
  | "download"
  /** A wrong version is enabled and the correct one isn't owned: download a different version. */
  | "download-replace"
  /**
   * Correct version downloaded but not installed: install it. Reserved; not
   * produced until uninstalled-state support lands (no resolver input yet).
   */
  | "install-uninstalled"
  /** Correct version installed but disabled while a wrong one is enabled: switch the active version. */
  | "toggle"
  /** Several alternatives satisfy the requirement; the user picks one. */
  | "or";

/**
 * Dependency not installed; download a file to satisfy it
 */
export interface IMissingFileRequirement {
  kind: "missing";
  /** Requirement definition id */
  requirementDefId: string;
  /** The file to download */
  candidate: IFileRequirementCandidate;
}

/**
 * A wrong version of the chain is enabled and no acceptable version is owned;
 * download a different (correct) version.
 */
export interface IWrongVersionInstalledRequirement {
  kind: "wrong-version-installed";
  /** Requirement definition id */
  requirementDefId: string;
  /** The wrong version currently enabled */
  installedFile: IInstalledFile;
  /** The correct version to download */
  candidate: IFileRequirementCandidate;
}

/**
 * Correct and wrong versions installed, wrong one enabled; switch the active version
 */
export interface IWrongVersionEnabledRequirement {
  kind: "wrong-version-enabled";
  /** Requirement definition id */
  requirementDefId: string;
  /** The wrong version currently enabled */
  enabledFile: IInstalledFile;
  /** The correct, disabled version to enable */
  correctFile: IInstalledFile;
}

/**
 * One alternative (update group) of an OR requirement, already classified to the
 * action it needs if chosen: download a file, or enable an owned-but-disabled one.
 */
export type IFileRequirementBranch =
  | {
      kind: "download";
      /** Update group this alternative belongs to */
      modFileId: string;
      /** The file to download for this alternative */
      candidate: IFileRequirementCandidate;
    }
  | {
      kind: "enable";
      /** Update group this alternative belongs to */
      modFileId: string;
      /** The acceptable, installed-but-disabled version to enable */
      correctFile: IInstalledFile;
      /** A wrong version of the same chain currently enabled, if any (makes it a switch) */
      enabledFile?: IInstalledFile;
    };

/**
 * Several alternatives satisfy the requirement; the user picks one. Branches that
 * are owned-but-disabled offer an enable/switch action instead of a download.
 */
export interface IOrFileRequirement {
  kind: "or";
  /** Requirement definition id */
  requirementDefId: string;
  /** The OR alternatives, one per update group */
  branches: IFileRequirementBranch[];
}

/**
 * A single dependency of a source file, discriminated on kind
 */
export type IFileRequirement =
  | IMissingFileRequirement
  | IWrongVersionInstalledRequirement
  | IWrongVersionEnabledRequirement
  | IOrFileRequirement;

/**
 * Unsatisfied requirements for one source file, as the resolver maps them. The UI
 * splits this into homogeneous per-category reports (IFileRequirementReport) for display.
 */
export interface IFileLevelRequirements {
  /** Composite id of the source file version that has the requirements */
  sourceFileUID: string;
  /** Source mod name, for the listing and detail headings */
  sourceModName: string;
  /** Composite id for the source mod, for building its Nexus links */
  sourceModUID: string;
  /** The source file's unsatisfied dependencies (kinds can be mixed) */
  requirements: IFileRequirement[];
}

/**
 * One category's worth of a source file's requirements: a single listing entry /
 * detail page. `requirements` are homogeneous to `category`.
 */
export interface IFileRequirementReport {
  /** Composite id of the source file version that has the requirements */
  sourceFileUID: string;
  /** Source mod name, for the listing and detail headings */
  sourceModName: string;
  /** Composite id for the source mod, for building its Nexus links */
  sourceModUID: string;
  /** The report category, driving copy, buttons and the detail layout */
  category: FileRequirementCategory;
  /** The source file's unsatisfied dependencies in this category */
  requirements: IFileRequirement[];
}

/**
 * Metadata for the file-level requirements health check result
 */
export interface IFileRequirementsCheckMetadata {
  /** Game ID this check was run for */
  gameId: string;
  /** Total number of installed files inspected */
  modsChecked: number;
  /** Requirements keyed by source file UID */
  fileRequirements: { [fileUID: string]: IFileLevelRequirements };
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
  runChecksByTrigger?: (trigger: HealthCheckTrigger) => Promise<IHealthCheckResult[]>;
}
