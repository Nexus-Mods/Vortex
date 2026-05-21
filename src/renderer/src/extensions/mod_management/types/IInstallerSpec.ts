/**
 * Spec types for `util.declareInstallers`. A game extension can describe its
 * installers as a config table and hand it to the helper, which generates the
 * `testSupported` / `install` pairs and calls `registerInstaller` for each row.
 */

import type { IInstallResult } from "./IInstallResult";

/**
 * `extensions`/`regex`/`filename` matches support two evaluation modes:
 *   - `any`: at least one file matches → installer accepts.
 *   - `all`: every (non-directory) file matches → installer accepts. Empty
 *     archives are rejected.
 */
export type InstallerMatchMode = "any" | "all";

/**
 * Discriminated union describing how an installer decides whether it supports
 * an archive. Directory entries (paths ending in path-sep) are filtered out
 * before evaluation in all modes.
 */
export type IInstallerMatch =
  | { kind: "extensions"; list: readonly string[]; mode: InstallerMatchMode }
  | { kind: "regex"; patterns: readonly RegExp[]; mode: InstallerMatchMode }
  | { kind: "filename"; names: readonly string[]; mode: InstallerMatchMode }
  /** Any file matches any of `game.details.stopPatterns` for the active game. */
  | { kind: "stopPatterns" }
  /** Escape hatch: caller-supplied predicate over the (raw) file list. */
  | { kind: "custom"; predicate: (files: string[]) => boolean };

/**
 * How matched files are turned into install instructions. `declareInstallers`
 * always emits `copy` instructions for every non-directory entry; this struct
 * tweaks paths and tagging.
 */
export interface IInstallerInstall {
  /**
   * If true and the archive wraps everything in a single top-level directory,
   * that directory is stripped from destination paths so the mod stages at
   * game root rather than inside the wrapper.
   */
  stripCommonRoot: boolean;
}

/**
 * One row in a game's installer config table.
 *
 * `id` doubles as the `registerInstaller` id (prefixed with `${gameId}-` if
 * `modType` is unset) and, when `modType` is set, gets emitted as a
 * `setmodtype` instruction at install time so deployment can be routed.
 */
export interface IInstallerSpec {
  id: string;
  priority: number;
  modType?: string;
  match: IInstallerMatch;
  install: IInstallerInstall;
}

/** Public signature of the install function `declareInstallers` synthesises. */
export type InstallerSpecInstallFunc = (
  files: string[],
  destinationPath: string,
) => Promise<IInstallResult>;
