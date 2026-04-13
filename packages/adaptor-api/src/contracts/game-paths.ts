import type { QualifiedPath } from "@vortex/fs";

/**
 * Well-known game folder names that the framework understands.
 * Adaptors may also return additional game-specific folder names.
 */
export const GameFolder = {
  install: "install",
  saves: "saves",
  preferences: "preferences",
  config: "config",
  cache: "cache",
} as const;

export type GameFolder = (typeof GameFolder)[keyof typeof GameFolder];

/**
 * A mapping of folder names to qualified paths.
 * Well-known {@link GameFolder} keys are typed; arbitrary game-specific
 * keys (e.g. `"creationKit"`, `"scripts"`) are also permitted.
 */
export type GameFolderMap = Partial<Record<GameFolder, QualifiedPath>> & {
  [key: string]: QualifiedPath | undefined;
};

/**
 * Adaptor-provided service that resolves a game's auxiliary folder paths
 * given a discovered installation location and the store that found it.
 *
 * Each game adaptor `@provides` this at its own URI
 * (e.g. `"vortex:adaptor/skyrim-se/paths"`).
 */
export interface IGamePathService {
  /**
   * Resolves the game's auxiliary folders relative to its installation.
   *
   * @param store - Which store discovered the game (`"steam"`, `"epic"`, `"gog"`, `"xbox"`).
   * @param installPath - The discovered game installation path
   *   (e.g. `steam://SteamApps/common/Skyrim Special Edition/`).
   * @returns A map of folder short names to qualified paths.
   *
   * @example
   * ```ts
   * // A Skyrim SE adaptor might return:
   * {
   *   [GameFolder.preferences]: QualifiedPath.parse("steam://documents/My Games/Skyrim Special Edition/"),
   *   [GameFolder.saves]:       QualifiedPath.parse("steam://documents/My Games/Skyrim Special Edition/Saves/"),
   *   [GameFolder.config]:      QualifiedPath.parse("steam://localAppData/Skyrim Special Edition/"),
   * }
   * ```
   */
  resolveGameFolders(
    store: string,
    installPath: QualifiedPath,
  ): Promise<GameFolderMap>;
}
