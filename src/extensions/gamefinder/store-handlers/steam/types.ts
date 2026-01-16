/**
 * Steam-specific types and data structures
 */

import type { Game } from "../../common";

/**
 * Steam App ID - unique identifier for a game/app on Steam
 */
export type AppId = number;

/**
 * Steam Depot ID
 */
export type DepotId = number;

/**
 * Steam Manifest ID
 */
export type ManifestId = bigint;

/**
 * Steam Build ID
 */
export type BuildId = number;

/**
 * State flags indicating the current state of an installed app
 */
export enum StateFlags {
  None = 0,
  Uninstalled = 1 << 0,
  UpdateRequired = 1 << 1,
  FullyInstalled = 1 << 2,
  Encrypted = 1 << 3,
  Locked = 1 << 4,
  FilesMissing = 1 << 5,
  AppRunning = 1 << 6,
  FilesCorrupt = 1 << 7,
  UpdateRunning = 1 << 8,
  UpdatePaused = 1 << 9,
  UpdateStarted = 1 << 10,
  Uninstalling = 1 << 11,
  BackupRunning = 1 << 12,
  Reconfiguring = 1 << 16,
  Validating = 1 << 17,
  AddingFiles = 1 << 18,
  Preallocating = 1 << 19,
  Downloading = 1 << 20,
  Staging = 1 << 21,
  Committing = 1 << 22,
  UpdateStopping = 1 << 23,
}

/**
 * Information about an installed depot
 */
export interface InstalledDepot {
  depotId: DepotId;
  manifestId: ManifestId;
  sizeOnDisk: bigint;
  dlcAppId?: AppId | undefined;
}

/**
 * Represents a Steam library folder
 */
export interface LibraryFolder {
  /**
   * Absolute path to the library folder
   */
  path: string;

  /**
   * Custom label for the library folder
   */
  label: string;

  /**
   * Total disk size in bytes
   */
  totalDiskSize: bigint;

  /**
   * Map of App IDs to their sizes on disk
   */
  appSizes: Map<AppId, bigint>;
}

/**
 * Steam app manifest - contains metadata about an installed game
 */
export interface AppManifest {
  /**
   * Unique app identifier
   */
  appId: AppId;

  /**
   * Display name of the app
   */
  name: string;

  /**
   * Current state flags
   */
  stateFlags: StateFlags;

  /**
   * Installation directory (relative to steamapps/common)
   */
  installDir: string;

  /**
   * Full absolute path to installation directory
   */
  installationDirectory: string;

  /**
   * Last update timestamp
   */
  lastUpdated?: Date | undefined;

  /**
   * Size on disk in bytes
   */
  sizeOnDisk: bigint;

  /**
   * Current build ID
   */
  buildId?: BuildId | undefined;

  /**
   * Last owner's Steam ID
   */
  lastOwner?: bigint | undefined;

  /**
   * Bytes to download for pending update
   */
  bytesToDownload: bigint;

  /**
   * Bytes already downloaded
   */
  bytesDownloaded: bigint;

  /**
   * Bytes to stage
   */
  bytesToStage: bigint;

  /**
   * Bytes already staged
   */
  bytesStaged: bigint;

  /**
   * Installed depots
   */
  installedDepots: InstalledDepot[];
}

/**
 * Represents a game found via Steam
 */
export interface SteamGame extends Game {
  store: "steam";

  /**
   * The app manifest for this game
   */
  appManifest: AppManifest;

  /**
   * The library folder containing this game
   */
  libraryFolder: LibraryFolder;

  /**
   * Path to the Steam installation
   */
  steamPath: string;
}

/**
 * Creates a SteamGame from its components
 */
export function createSteamGame(
  appManifest: AppManifest,
  libraryFolder: LibraryFolder,
  steamPath: string,
): SteamGame {
  return {
    id: appManifest.appId.toString(),
    name: appManifest.name,
    path: appManifest.installationDirectory,
    store: "steam",
    appManifest,
    libraryFolder,
    steamPath,
  };
}
