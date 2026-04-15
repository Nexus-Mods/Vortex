import type { RelativePath } from "@vortex/fs";

import type { Base, StorePathSnapshot } from "../stores/providers.js";
import type { GamePaths } from "./game-paths.js";

/**
 * One archive file's destination, rooted at an anchor from the same
 * adaptor's {@link IGamePathService}.
 *
 * `anchor` must be a key present in the {@link GamePaths} returned by
 * `IGamePathService.paths()` for this game. The host uses the anchor to
 * resolve the concrete {@link QualifiedPath} at deployment time.
 *
 * @public */
export interface InstallMapping<T extends string = never> {
  /** Relative path inside the archive. */
  readonly source: RelativePath;
  /** Anchor key into the adaptor's {@link GamePaths}. */
  readonly anchor: T | Base;
  /** Path under the anchor where the file should be deployed. */
  readonly destination: RelativePath;
}

/**
 * Adaptor-provided service that decides where each file in a mod
 * archive should be deployed for this game.
 *
 * The generic `T` mirrors the extra key space declared by the paired
 * {@link IGamePathService}. Returned mappings may reference any anchor
 * in that space plus the well-known {@link Base} keys.
 *
 * @public */
export interface IGameInstallerService<T extends string = never> {
  /**
   * Produces one {@link InstallMapping} per archive file to be deployed.
   *
   * The `context` argument is the same {@link StorePathSnapshot} that
   * `IGamePathService.paths()` receives, so store, baseOS, gameOS, and
   * pre-resolved bases are all accessible without a second RPC. The
   * `paths` argument is the same map previously returned by this
   * adaptor's `paths()` method; call {@link rehydrateGamePaths} on it
   * if path manipulation is needed, as it has crossed a structured-
   * clone boundary.
   *
   * Files that should not be deployed can be omitted from the output.
   * Adaptors that cannot handle the archive should throw; callers
   * decide fallback policy.
   *
   * @example
   * ```ts
   * async install(
   *   _context: StorePathSnapshot,
   *   _paths: GamePaths<"saves">,
   *   files: readonly RelativePath[],
   * ): Promise<readonly InstallMapping<"saves">[]> {
   *   return files.map((source) => ({
   *     source,
   *     anchor: source.endsWith(".sav") ? "saves" : Base.Game,
   *     destination: source,
   *   }));
   * }
   * ```
   */
  install(
    context: StorePathSnapshot,
    paths: GamePaths<T>,
    files: readonly RelativePath[],
  ): Promise<readonly InstallMapping<T>[]>;
}
