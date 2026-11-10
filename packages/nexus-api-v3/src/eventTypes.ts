export type TelemetryEvent = EventDetectedGame | EventStoreGameVersion | EventManualInstaller;

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
