import type {
  ISerializedDiscovery,
  ISerializedGameMeta,
  ISerializedInstallResult,
  ISerializedInstallerMeta,
  ISupportedResult,
} from "@vortex/shared/ipc";

/**
 * Implement this interface to add game support that runs entirely in the main process.
 * Register instances via `GameAdaptorRegistry.registerGame()`.
 *
 * Static metadata (id, name, requiredFiles, etc.) is declared directly on the object.
 * Dynamic behaviour (game discovery, setup, version detection) is implemented as methods.
 */
export interface IGameAdaptor {
  readonly id: string;
  readonly name: string;
  readonly shortName?: string;
  readonly logo?: string;
  readonly requiredFiles: string[];
  readonly mergeMods: boolean;
  /** Relative path from the game directory to the mods folder, e.g. "Mods" or ".". */
  readonly modPath: string;
  /** Relative path to the main executable, e.g. "Stardew Valley.exe". */
  readonly executablePath: string;
  readonly environment?: Record<string, string>;
  readonly parameters?: string[];
  readonly details?: Record<string, string | number | boolean>;
  readonly compatible?: Record<string, boolean>;

  /** Optional: discover the game installation path (e.g. via Steam, registry, or file system). */
  queryPath?(): Promise<string | null>;

  /** Optional: run pre-activation setup (e.g. create mod directories, patch config files). */
  setup?(discovery: ISerializedDiscovery): Promise<void>;

  /** Optional: return a human-readable version string for the installed game. */
  getGameVersion?(gamePath: string, exePath: string): Promise<string>;
}

/**
 * Implement this interface to add a mod installer that runs entirely in the main process.
 * Register instances via `GameAdaptorRegistry.registerInstaller()`.
 */
export interface IInstallerAdaptor {
  readonly id: string;
  readonly priority: number;

  /**
   * Return `{ supported: true }` if this installer should handle the given archive.
   * Called for every registered installer in priority order; first `supported: true` wins.
   */
  testSupported(files: string[], gameId: string): Promise<ISupportedResult>;

  /**
   * Produce a list of installation instructions for the archive.
   * Called only when `testSupported` returned `supported: true`.
   */
  install(
    files: string[],
    tempPath: string,
    gameId: string,
  ): Promise<ISerializedInstallResult>;
}

// Re-export shared types so adaptor implementations only need one import.
export type {
  ISerializedDiscovery,
  ISerializedGameMeta,
  ISerializedInstallResult,
  ISerializedInstallerMeta,
  ISupportedResult,
};
