import type Promise from "bluebird";

import type { IGame } from "../../types/IGame";
import type { ITool } from "../../types/ITool";

/**
 * Store identifiers for game discovery across different game stores.
 * Numeric IDs can be specified as numbers (no quotes needed in YAML).
 */
export interface GameDefStores {
  /**
   * Steam App ID (e.g., 489830 for Skyrim SE)
   */
  steam?: string | number;

  /**
   * GOG Game ID (e.g., 1711230643 for Skyrim SE)
   */
  gog?: string | number;

  /**
   * Epic Games Store Catalog Item ID
   */
  epic?: string;

  /**
   * Xbox Game Pass Product ID (Identity Name from appxmanifest.xml)
   */
  xbox?: string;
}

/**
 * Normalized store identifiers with all values as strings.
 */
export interface NormalizedStores {
  steam?: string;
  gog?: string;
  epic?: string;
  xbox?: string;
}

/**
 * Environment variable definition with support for store ID interpolation.
 */
export interface GameDefEnvironment {
  /**
   * Environment variable name (e.g., 'SteamAPPId')
   */
  var: string;

  /**
   * Value for the environment variable.
   * Supports interpolation: $steam, $gog, $epic, $xbox will be replaced with store IDs.
   */
  value: string;
}

/**
 * Tool definition in YAML format, simplified from ITool.
 */
export interface GameDefTool {
  id: string;
  name: string;
  shortName?: string;
  logo?: string;
  executable: string;
  requiredFiles?: string[];
  relative?: boolean;
  exclusive?: boolean;
  defaultPrimary?: boolean;
  detach?: boolean;
  shell?: boolean;
  parameters?: string[];
  onStart?: "hide" | "hide_recover" | "close";
}

/**
 * Game definition in YAML format.
 * This is a simplified, declarative representation of an IGame
 * that gets transformed into a full IGame object at runtime.
 */
export interface GameDef {
  /**
   * Unique game identifier (lowercase, no spaces).
   * This becomes the game's internal ID in Vortex.
   */
  id: string;

  /**
   * Display name of the game shown in the UI.
   */
  name: string;

  /**
   * Abbreviated name for compact UI spaces.
   * If not provided, falls back to name.
   */
  shortName?: string;

  /**
   * Logo filename (relative to extension assets).
   */
  logo: string;

  /**
   * Main executable filename(s) relative to game root.
   * Can be a single string or an array for games with multiple possible executables.
   */
  executable: string | string[];

  /**
   * Store identifiers for automatic game discovery.
   * These are used to populate queryArgs, gameFinder, details, and environment.
   */
  stores?: GameDefStores;

  /**
   * Path to mods directory relative to game root.
   * Use '.' if mods are installed directly into the game directory.
   * Use 'queryModPath' to indicate that custom logic should handle this.
   */
  modPath: string;

  /**
   * Whether to merge mods in the destination directory.
   * @default true
   */
  mergeMods?: boolean;

  /**
   * Files that must exist in the directory to identify this game.
   * If not provided, defaults to the executable(s).
   */
  requiredFiles?: string[];

  /**
   * Environment variables to set when launching the game.
   * Supports $steam, $gog, $epic, $xbox interpolation.
   */
  environment?: GameDefEnvironment[];

  /**
   * Name of companion TypeScript/JavaScript file for custom logic.
   * The file should export functions like queryModPath, setup, requiresLauncher, etc.
   */
  customLogic?: string;

  /**
   * Additional tools that support this game.
   */
  supportedTools?: GameDefTool[];

  /**
   * Nexus Mods page ID for this game (e.g., 'skyrimspecialedition').
   */
  nexusPageId?: string;

  /**
   * Files used for hash-based version detection.
   */
  hashFiles?: string[];

  /**
   * Registry path for game discovery (Windows only).
   * Format: 'HKEY_LOCAL_MACHINE:Software\\Path\\To\\Key:ValueName'
   */
  registryPath?: string;
}

/**
 * Custom logic that can be provided by a companion file.
 * These functions can override or extend the auto-generated IGame properties.
 */
export interface IGameCustomLogic {
  /**
   * Custom queryModPath implementation.
   */
  queryModPath?: (gamePath: string) => string;

  /**
   * Custom setup function.
   */
  setup?: (discovery: any) => Promise<void>;

  /**
   * Custom requiresLauncher implementation.
   */
  requiresLauncher?: (
    gamePath: string,
    store?: string,
  ) => Promise<{ launcher: string; addInfo?: any } | undefined>;

  /**
   * Custom getGameVersion implementation.
   */
  getGameVersion?: (gamePath: string, exePath: string) => Promise<string>;

  /**
   * Any additional properties to merge into the game object.
   */
  [key: string]: any;
}

/**
 * Result of validating a GameDef against the schema.
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}
