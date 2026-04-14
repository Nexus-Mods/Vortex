import type { QualifiedPath } from "@vortex/fs";

/**
 * Well-known game folder names that the framework understands.
 * Adaptors may also return additional game-specific folder names.
 */
export const GameFolder = {
  install: "install",
  saves: "saves",
  preferences: "preferences",
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
 * Adaptor-provided service that resolves a game's folder paths given
 * store-scoped and game-scoped base paths.
 *
 * Each game adaptor `@provides` this at its own URI
 * (e.g. `"vortex:adaptor/skyrim-se/paths"`).
 */
export interface IGamePathService {
  /**
   * Resolves the game's folders by composing paths onto the store base.
   *
   * The adaptor constructs store-scheme paths for each folder using
   * well-known sub-paths on `storeBase`:
   * - `storeBase/install` -- the game's install directory
   * - `storeBase/home` -- OS home directory (`%USERPROFILE%`)
   * - `storeBase/documents` -- OS Documents directory
   * - `storeBase/my games` -- OS My Games directory
   * - `storeBase/appData` -- OS AppData directory
   *
   * The framework builds a game resolver from the returned map by
   * mapping each folder name onto `gameBase`:
   * ```
   * gameBase.join(folderName) → returned storePath
   * ```
   *
   * @param storeBase - Store-scoped root path (e.g. `steam://1234`).
   *   The adaptor joins OS bases and game-specific sub-paths onto this.
   * @param gameBase - Game-scoped root path (e.g. `game://steam/1234`).
   *   Passed for context; the framework uses it to build resolver mappings.
   * @returns A map of folder short names to store-scheme qualified paths.
   *
   * @example
   * ```ts
   * // storeBase = steam://1234
   * // A Skyrim SE adaptor might return:
   * {
   *   [GameFolder.install]:     qpath`${storeBase}/install`,
   *   [GameFolder.saves]:       qpath`${storeBase}/my games/Skyrim Special Edition/Saves`,
   *   [GameFolder.preferences]: qpath`${storeBase}/appData/Local/Skyrim Special Edition`,
   * }
   * ```
   */
  resolveGameFolders(
    storeBase: QualifiedPath,
    gameBase: QualifiedPath,
  ): Promise<GameFolderMap>;
}
