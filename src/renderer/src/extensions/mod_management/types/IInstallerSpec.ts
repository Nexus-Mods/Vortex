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
 * Per-file selector applied during install. Unlike `IInstallerMatch` (which
 * decides whether an installer claims the whole archive), a filter classifies
 * individual files: only matching files appear in the install output; the rest
 * are silently dropped.
 *
 * Use to strip readmes/screenshots from a deploy where the target is a flat
 * importable directory (character pools, savegames) and unrelated files have
 * nowhere meaningful to live.
 */
export type IInstallerFilter =
  | { kind: "extensions"; list: readonly string[] }
  | { kind: "regex"; patterns: readonly RegExp[] }
  | { kind: "filename"; names: readonly string[] }
  | { kind: "custom"; predicate: (file: string) => boolean };

/**
 * How matched files are turned into install instructions. `declareInstallers`
 * always emits `copy` instructions for every non-directory entry that survives
 * `filter`; this struct tweaks selection, paths, and tagging.
 */
export interface IInstallerInstall {
  /**
   * If true and the (post-filter) archive wraps everything in a single
   * top-level directory, that directory is stripped from destination paths so
   * the mod stages at game root rather than inside the wrapper. Ignored when
   * `flatten` is true.
   */
  stripCommonRoot: boolean;

  /**
   * Optional per-file selector. When set, only files matching the selector
   * are copied; others are dropped from the install output (and not
   * considered when computing the common root).
   *
   * Filtering every file leaves only the `setmodtype` instruction (if any).
   * The empty-output case isn't an error here — surface it via a health
   * check on the resulting mod rather than failing the install.
   */
  filter?: IInstallerFilter;

  /**
   * When true, every destination path is reduced to `path.basename(source)`.
   * Useful for importer-style targets where the game reads files
   * non-recursively from a flat directory (character pools, savegame
   * folders).
   *
   * Takes precedence over `stripCommonRoot` — setting both is harmless but
   * `stripCommonRoot` has no effect. Two source files with the same
   * basename in different folders flatten to the same destination; the
   * later `copy` overwrites the earlier one (consistent with Vortex's
   * existing same-destination handling).
   */
  flatten?: boolean;
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
