export type TelemetryEvent = EventDetectedGame | EventStoreGameVersion | EventGameFolderState;

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

// Draft: not yet agreed in flamework contracts/telemetry (MOD-80).
export type EventGameFolderState = {
  type: "game_folder_state";
  version: 1;

  payload: GameFolderStatePayload;
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
  vortex: GameFolderFileCount;
  vortex_changed_since_deploy: GameFolderFileCount;
  /** every modified and missing file, and up to the cap of unknown files */
  files: GameFolderFile[];
  unknown_truncated: boolean;
  /** every unknown file, totalled by its first two folders */
  unknown_by_folder: GameFolderFolderCount[];
  cost: {
    duration_ms: number;
    files_walked: number;
    bytes_read: number;
  };
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
};

export type GameFolderFolderCount = {
  folder: string;
  files: number;
  bytes: number;
};
