/**
 * Prelaunch Contract
 *
 * Allows adaptors to declare tools that must run before the game
 * launches. The framework orchestrates execution in order and handles
 * failure. Tasks can be conditional (only run when the adaptor says so).
 */

import type { QualifiedPath } from "../fs/paths";
import type { GamePaths } from "./game-paths.js";

/**
 * Describes a single prelaunch task. The framework resolves the
 * executable path to a native path and spawns the process.
 */
export interface PrelaunchTask {
  /** Unique ID for this task within the adaptor. */
  id: string;
  /** Human-readable name for UI display and logging. */
  name: string;
  /** Path to the executable to run. */
  executable: QualifiedPath;
  /** Command-line arguments. */
  args?: string[];
  /** Environment variables to set. */
  environment?: Record<string, string>;
  /**
   * If true, the framework should evaluate {@link shouldRun} before
   * executing. If false or absent, the task always runs.
   */
  conditional?: boolean;
}

/**
 * Adaptor-provided service for declaring prelaunch tasks.
 * Each game adaptor `@provides` this at its own URI. The generic `T`
 * mirrors the extra key space declared by {@link IGamePathService}.
 */
export interface IGamePrelaunchService<T extends string = never> {
  /**
   * Returns the prelaunch tasks this adaptor wants to run before
   * the game launches. Called once when building the launch sequence.
   */
  getPrelaunchTasks(paths: GamePaths<"game" | T>): Promise<PrelaunchTask[]>;

  /**
   * Evaluates whether a conditional task should run. Only called for
   * tasks where `conditional` is true. The adaptor inspects game state
   * (e.g. "have archive mods changed since last REDmod deploy?") and
   * returns true if the task should execute.
   */
  shouldRun(paths: GamePaths<"game" | T>, taskId: string): Promise<boolean>;
}
