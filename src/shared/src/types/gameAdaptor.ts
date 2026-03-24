/**
 * Serializable types for the main-process game adaptor IPC system.
 * All types here must cross the Electron IPC boundary (no functions, no Buffers, no class instances).
 */

/**
 * Serializable form of a game's discovery result.
 * Mirrors IDiscoveryResult from the renderer but uses only IPC-safe fields.
 */
export interface ISerializedDiscovery {
  path: string;
  executable?: string;
  store?: string;
}

/**
 * Serializable metadata for a game adaptor registered in the main process.
 * Static fields are sent once via `game-adaptor:list`; dynamic fields are fetched via `game-adaptor:*` calls.
 */
export interface ISerializedGameMeta {
  id: string;
  name: string;
  shortName?: string;
  logo?: string;
  requiredFiles: string[];
  /** Only boolean is supported for main-process adaptors (not the function form). */
  mergeMods: boolean;
  /** Static result of queryModPath. Relative to the game directory. */
  modPath: string;
  /** Static result of executable(). Relative to the game directory. */
  executablePath: string;
  environment?: Record<string, string>;
  parameters?: string[];
  details?: Record<string, string | number | boolean>;
  compatible?: Record<string, boolean>;
  /**
   * Store-based game discovery arguments. When present, Vortex uses these to
   * locate the game via Steam, GOG, Epic, Xbox, or the Windows registry instead
   * of calling queryPath() over IPC.
   */
  queryArgs?: Record<string, Array<{ id: string }>>;
  // Capability flags — tells the bridge which optional IPC calls are valid.
  hasQueryPath: boolean;
  hasSetup: boolean;
  hasGetGameVersion: boolean;
}

/** Serializable metadata for an installer adaptor registered in the main process. */
export interface ISerializedInstallerMeta {
  id: string;
  priority: number;
}

/** Whether an installer supports a given archive. */
export interface ISupportedResult {
  supported: boolean;
  requiredFiles: string[];
}

/**
 * A single installation instruction, serializable for IPC.
 * Covers the most common instruction types: copy, mkdir, attribute, setmodtype, generatefile.
 * Buffer-based `data` (e.g. for generatefile) is not supported over IPC.
 */
export interface ISerializedInstruction {
  type: string;
  source?: string;
  destination?: string;
  path?: string;
  key?: string;
  value?: string | number | boolean;
}

/** Serializable form of IInstallResult returned by an installer over IPC. */
export interface ISerializedInstallResult {
  instructions: ISerializedInstruction[];
}
