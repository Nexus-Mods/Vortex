/**
 * Mod Files Contract
 *
 * Host-provided service that gives adaptors read access to installed
 * mod files. Adaptors never get raw filesystem access; instead they
 * request mod metadata and file listings through this service, and
 * receive QualifiedPaths they can pass to the host filesystem service.
 *
 * This is a host service (provided by Vortex), not an adaptor service.
 */

import type { QualifiedPath } from "../fs/paths";

/**
 * Summary of a single installed mod visible to the adaptor.
 */
export interface ModSummary {
  /** Vortex mod ID. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Mod type (e.g. "" for default, "enb", "dinput"). */
  type: string;
  /** Whether this mod is enabled in the active profile. */
  enabled: boolean;
  /** Adaptor-opaque attributes (version, author, etc.). */
  attributes?: Record<string, unknown>;
}

/**
 * A file within a mod's staging directory.
 */
export interface ModFileEntry {
  /** Path relative to the mod's staging root. */
  relativePath: string;
  /** Qualified path that can be passed to the filesystem service. */
  qualifiedPath: QualifiedPath;
  /** File size in bytes. */
  size: number;
}

/**
 * A file in the flattened deployment view. Shows what the game
 * directory looks like with all mods applied in load order.
 */
export interface DeployedFileEntry {
  /** Path relative to the deployment target (game directory). */
  relativePath: string;
  /** The mod ID that owns this file (winner of any conflicts). */
  sourceModId: string;
  /** Qualified path to the deployed file. */
  qualifiedPath: QualifiedPath;
}

/**
 * Host-provided service for querying installed mod files.
 * Registered as `vortex:host/mod-files` and available to all adaptors.
 */
export interface IModFilesService {
  /**
   * Returns summaries of all mods installed for the active game.
   */
  getInstalledMods(): Promise<ModSummary[]>;

  /**
   * Returns the file listing for a specific mod's staging directory.
   * All paths are qualified and must be accessed through the
   * filesystem service.
   */
  getModFiles(modId: string): Promise<ModFileEntry[]>;

  /**
   * Returns the flattened deployment view: what the game directory
   * looks like with all enabled mods applied in their current order.
   * Each file shows which mod "wins" at that path.
   */
  getDeployedFiles(): Promise<DeployedFileEntry[]>;
}
