import type { QualifiedPath } from "@vortex/fs";

import type { GameFolderMap } from "./game-paths.js";

/**
 * A mod type describes a category of mod and how to detect/deploy it.
 */
export interface ModType {
  /** Human-readable name. */
  name: string;
  /** Where this mod type deploys, relative to game install. */
  targetPath: QualifiedPath;
  /** Directory paths that mark the mod root in archives.
   *  Plain path strings (e.g. `"archive/pc/mod"`, `"r6/scripts"`). */
  stopPatterns: string[];
  /** Glob patterns matching files that belong to this mod type
   *  (e.g. `"*.archive"`, `"*.lua"`). */
  filePatterns?: string[];
  /** Test this type after the named type(s). */
  runsAfter?: string | string[];
  /** Test this type before the named type(s). */
  runsBefore?: string | string[];
  /** If true, mods of this type merge into the same directory. Default true. */
  mergeMods?: boolean;
}

/**
 * Mod types keyed by type ID (e.g. `"archive"`, `"cet"`, `"redscript"`).
 */
export type GameModTypesInfo = Record<string, ModType>;

/**
 * Adaptor-provided service for declaring the mod types a game supports.
 * Each game adaptor `@provides` this at its own URI.
 */
export interface IGameModTypesService {
  getModTypes(folders: GameFolderMap): Promise<GameModTypesInfo>;
}

/**
 * Builds a validated {@link GameModTypesInfo} from a mod type record.
 * Currently a passthrough — validates structure at the type level.
 *
 * @example
 * ```ts
 * gameModTypes({
 *   archive: {
 *     name: "Archive Mod",
 *     targetPath: qpath`${install}/archive/pc/mod`,
 *     stopPatterns: ["archive/pc/mod"],
 *     filePatterns: ["*.archive", "*.xl"],
 *   },
 *   cet: {
 *     name: "Cyber Engine Tweaks",
 *     targetPath: qpath`${install}/bin/x64/plugins/cyber_engine_tweaks`,
 *     stopPatterns: ["bin/x64/plugins/cyber_engine_tweaks"],
 *     filePatterns: ["*.lua"],
 *   },
 * })
 * ```
 */
export function gameModTypes(input: GameModTypesInfo): GameModTypesInfo {
  return input;
}
