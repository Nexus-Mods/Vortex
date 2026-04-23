import { type QualifiedPath, QualifiedPath as QP } from "@vortex/fs";

import type { GamePaths } from "./game-paths.js";

/**
 * The main game executable. Always exclusive — the framework knows
 * the game name from {@link IGameInfoService}, so no name is needed here.
 */
export interface GameExecutable {
  executable: QualifiedPath;
  /** Default command-line arguments. */
  parameters?: string[];
  /** Environment variables to set when launching. */
  environment?: Record<string, string>;
}

/**
 * An additional tool that ships with or supports the game.
 */
export interface ToolEntry {
  executable: QualifiedPath;
  /** Human-readable name for UI display. */
  name: string;
  /** Abbreviated name for compact UI (max ~8 chars). Falls back to name. */
  shortName?: string;
  /** Default command-line arguments. */
  parameters?: string[];
  /** Environment variables to set when launching. */
  environment?: Record<string, string>;
  /** Files that must exist to consider this tool present. */
  requiredFiles?: QualifiedPath[];
  /** If true, blocks other tools while running. Default false. */
  exclusive?: boolean;
  /** If true, use as primary launcher when installed. Default false. */
  defaultPrimary?: boolean;
  /** If true, run inside a shell. Default false. */
  shell?: boolean;
  /** If true, detach from Vortex process. Default false. */
  detach?: boolean;
  /** Vortex window behavior on launch. */
  onStart?: "hide" | "hide_recover" | "close";
}

/**
 * Complete tool definitions for a game.
 */
export interface GameToolsInfo {
  /** The main game executable. Always launched exclusively. */
  game: GameExecutable;
  /** Additional tools keyed by tool ID (e.g. `"f4se"`, `"redmod"`). */
  tools?: Record<string, ToolEntry>;
}

/**
 * Adaptor-provided service for declaring game executables and tools.
 * Each game adaptor `@provides` this at its own URI. The generic `T`
 * mirrors the extra key space declared by {@link IGamePathService}
 * for this adaptor.
 */
export interface IGameToolsService<T extends string = never> {
  getGameTools(paths: GamePaths<"game" | T>): Promise<GameToolsInfo>;
}

// --- Shorthand input types ---

/** Game executable input: a QualifiedPath (just the exe) or full object. */
type GameExecutableInput = QualifiedPath | GameExecutable;

/** Permissive input for {@link gameTools}. */
export interface GameToolsInput {
  game: GameExecutableInput;
  tools?: Record<string, ToolEntry>;
}

function isQualifiedPath(value: unknown): value is QualifiedPath {
  if (value instanceof QP) return true;
  return (
    typeof value === "object" &&
    value !== null &&
    "scheme" in value &&
    "path" in value
  );
}

/**
 * Builds a validated {@link GameToolsInfo} from shorthand input.
 *
 * The `game` field accepts a `QualifiedPath` (just the executable) or
 * a full {@link GameExecutable} object.
 *
 * @example
 * ```ts
 * gameTools({
 *   game: qpath`${install}/bin/x64/Cyberpunk2077.exe`,
 *   tools: {
 *     redmod: { executable: qpath`${install}/tools/redmod/bin/redMod.exe`, name: "REDmod" },
 *   },
 * })
 * ```
 */
export function gameTools(input: GameToolsInput): GameToolsInfo {
  const game: GameExecutable = isQualifiedPath(input.game)
    ? { executable: input.game }
    : input.game;

  return {
    game,
    tools: input.tools,
  };
}
