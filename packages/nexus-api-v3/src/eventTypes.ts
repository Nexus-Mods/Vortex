export type TelemetryEvent =
  | EventDetectedGame
  | EventStoreGameVersion
  | EventManualInstaller
  | EventPlannerPlan
  | EventGameFolderState
  | EventGameFolderStateFiles;

// https://github.com/Nexus-Mods/flamework/tree/master/contracts/telemetry
export type EventDetectedGame = {
  type: "detected_games";
  version: 1;

  payload: {
    steam: string[];
    gog: string[];
    epic: string[];
  };
};

export type EventStoreGameVersion = {
  type: "store_game_version";
  version: 1;

  payload: StoreGameVersionPayload;
};

type StoreGameVersionBase = {
  game_id: string;
  failure_reason: string | null;
  exe_version: string | null;
  extension_version: string | null;
};

type SteamInstallBase = {
  app_id: number;
  build_id: number;
  branch: string | null;
  language: string;
  mounted_language: string;
  state_flags: number;
  target_build_id: number;
};

export type StoreGameVersionPayload =
  | (StoreGameVersionBase & { store: "steam"; steam: SteamInstall | null })
  | (StoreGameVersionBase & { store: "gog"; gog: GogInstall | null })
  | (StoreGameVersionBase & { store: "epic" | "xbox" });

export type SteamInstall = SteamInstallBase & {
  depots: SteamDepot[];
  shared_depots: SteamSharedDepot[];
};

export type SteamDepot = {
  depot_id: number;
  manifest_id: string;
  dlc_app_id: string | null;
};

export type SteamSharedDepot = {
  depot_id: number;
  owner_app_id: number;
};

export type GogInstall = {
  product_id: string;
  build_id: string;
  install_language: string;
};

/**
 * The folder inside a game's install folder that a user chose in the Manual Installer dialog,
 * for a game managed without an extension. Sent once when the install of the mod the dialog
 * belongs to finishes successfully. manual_installer/v1.schema.json on the backend.
 */
export type EventManualInstaller = {
  type: "manual_installer";
  version: 1;

  payload: {
    /**
     * UNIX-style absolute path from the game's install folder: `/` is the game root, a
     * subfolder is `/Data/Sub/`. Always starts with `/`, always forward slashes. A value
     * longer than 256 characters is truncated, so one that doesn't end with `/` is truncated.
     */
    destination: string;
    /** the numeric Nexus game id */
    game_id: number;
    /** the numeric Nexus mod id, null when the archive isn't a Nexus mod */
    mod_id: number | null;
    /** the numeric Nexus file id, only set when mod_id is set */
    file_id: number | null;
  };
};

export type EventPlannerPlan = {
  type: "planner_plan";
  version: 1;

  payload: PlannerPlanPayload;
};

/** contracts/telemetry/planner_plan/v1.schema.json; null is a figure the run did not measure. */
export type PlannerPlanPayload = {
  game_id: string;
  mods: number | null;
  lockfile_files: number | null;
  generated_files: number | null;
  disk_entries: number | null;
  scan_roots: number | null;
  first_run: boolean | null;
  resolve_ms: number | null;
  scan_ms: number | null;
  plan_ms: number | null;
  operations: PlannerOperationCounts | null;
  case_mismatches: number | null;
  manifest_diff: ManifestDiff | null;
  error_kind: string | null;
};

/** The operations a plan would perform, by kind. */
export type PlannerOperationCounts = {
  backup: number;
  link: number;
  unlink: number;
};

/** Why one destination differs between the lockfile and what the deployment wrote. */
export type ManifestDiffReason =
  | "missing-from-lockfile"
  | "missing-from-deploy"
  | "different-winner";

/** How the lockfile differs from what the deployment wrote, counted by reason code. */
export type ManifestDiff = {
  verdict: "pass" | "fail";
  counts: Record<ManifestDiffReason, number>;
};

// https://github.com/Nexus-Mods/flamework/tree/master/contracts/telemetry
// One check is a game_folder_state event with everything but the file paths, plus up to
// max_file_parts game_folder_state_files events holding the paths.
export type EventGameFolderState = {
  type: "game_folder_state";
  version: 1;

  payload: GameFolderStatePayload;
};

export type EventGameFolderStateFiles = {
  type: "game_folder_state_files";
  version: 1;

  payload: GameFolderStateFilesPayload;
};

export type GameFolderFileCount = {
  files: number;
  bytes: number;
};

export type GameFolderPartStatus = {
  status: "checked" | "aborted";
  reason: string | null;
};

export type GameFolderStatePayload = {
  /** shared with this check's game_folder_state_files events */
  check_id: string;
  game_id: string;
  /** "checked" means the folder was listed; Steam verification carries its own status */
  status: "checked" | "no_baseline" | "aborted";
  reason: string | null;
  verification: GameFolderPartStatus | null;
  /** a Vortex deployment was in the folder when the check ran */
  deployed_before_check: boolean;
  full_verify: boolean;
  steam: {
    app_id: number;
    build_id: number;
    depots: GameFolderDepot[];
  };
  managed_at: string;
  steam_last_updated: string | null;
  folder_created_at: string | null;
  steam_files: {
    /** hashed and matched */
    verified: GameFolderFileCount;
    /** same size as Steam's, not picked for hashing */
    size_matched: GameFolderFileCount;
    modified: GameFolderFileCount;
    missing: GameFolderFileCount;
    unreadable: GameFolderFileCount;
    not_compared: GameFolderFileCount;
    /** files the check stopped before reaching */
    unchecked: GameFolderFileCount;
  };
  modified_by: {
    size: number;
    sampled_chunk: number;
    full_hash: number;
  };
  /** with full_verify: modified files the chunk sample alone would have missed */
  sample_missed: number | null;
  /** with full_verify: modified files the file sample wouldn't have picked */
  file_sample_missed: number | null;
  /** files hashed: a random sample of the same-size executables and of the other files */
  hashed_sample: { files: number; capped: boolean };
  unknown: GameFolderFileCount;
  /** unknown files in a folder Vortex created, or below one; included in `unknown` */
  unknown_in_vortex_folder: GameFolderFileCount;
  vortex: GameFolderFileCount;
  vortex_changed_since_deploy: GameFolderFileCount;
  /** game_folder_state_files events sent with this one; 0 when there were no paths to send */
  file_parts: number;
  /** the most file events a check could send when this one ran; 0 turns the paths off */
  max_file_parts: number;
  /** some modified or missing files were left out of the file events for lack of room */
  files_truncated: boolean;
  /** some unknown files were left out of the file events, past the cap or for lack of room */
  unknown_truncated: boolean;
  /** every unknown file, totalled by its first two folders; largest first when trimmed */
  unknown_by_folder: GameFolderFolderCount[];
  /** some folders were left out of `unknown_by_folder` to fit the payload limit */
  unknown_by_folder_truncated: boolean;
  cost: {
    duration_ms: number;
    files_walked: number;
    bytes_read: number;
  };
};

export type GameFolderStateFilesPayload = {
  check_id: string;
  game_id: string;
  /** from 1 */
  part: number;
  /** file events in this check; its paths are complete when all of them arrived */
  parts: number;
  /**
   * modified and missing files first, then unknown files, running on from the part before; each
   * event holds as many as fit in the payload limit
   */
  files: GameFolderFile[];
};

export type GameFolderDepot = {
  depot_id: number;
  manifest_id: string;
  manifest_created_at: string | null;
};

export type GameFolderFile = {
  /** relative to the game folder, `/` separators */
  path: string;
  status: "modified" | "missing" | "unknown";
  /** modified only */
  detected_by?: "size" | "sampled_chunk" | "full_hash";
  /** modified only: the original was the .vortex_backup Vortex made when deploying over it */
  from_backup?: true;
  /** unknown only: in a folder Vortex created, so likely written by a deployed mod at runtime */
  in_vortex_folder?: true;
};

export type GameFolderFolderCount = {
  folder: string;
  files: number;
  bytes: number;
};
