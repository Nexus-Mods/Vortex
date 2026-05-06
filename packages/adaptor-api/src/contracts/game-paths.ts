import type { StorePathProvider } from "../stores/providers";
import type { VersionSource } from "./game-version";

import { QualifiedPath } from "../fs/paths";

/**
 * Path-map returned by an adaptor's {@link IGamePathService.paths}.
 *
 * A plain mapped type whose keys are the adaptor-declared string
 * literals `T`. The mandatory `"game"` key is injected at the
 * interface level ({@link IGamePathService}), not inside this type.
 *
 * Values are concrete OS-scheme {@link QualifiedPath}s the adaptor
 * built from a {@link StorePathProvider} — the framework does not
 * resolve them further.
 *
 * @public */
export type GamePaths<T extends string> = { [K in T]: QualifiedPath };

/**
 * Adaptor-provided service that resolves a game's folder paths.
 *
 * Each game adaptor `@provides` this at its own URI
 * (e.g. `"vortex:adaptor/skyrim-se/paths"`). The generic `T` is the
 * adaptor-declared extra key space — a union of string literals for
 * whatever game-specific folders the adaptor exposes beyond the
 * required {@link Base.Game}.
 *
 * @public */
export interface IGamePathService<T extends string = never> {
  /**
   * Returns the full {@link GamePaths} for the discovered game.
   *
   * The adaptor receives a {@link StorePathProvider} already scoped to
   * this discovery (store, host OS, game runtime OS, install path).
   * The returned object must include a `"game"` entry — the framework
   * uses it to populate the install directory.
   *
   * @example
   * ```ts
   * async paths(provider: StorePathProvider): Promise<GamePaths<"game" | "saves">> {
   *   const game = await provider.fromBase(Base.Game);
   *   const saves = provider.isWindows
   *     ? (await provider.fromBase(Base.Home)).join("Saved Games", "My Game")
   *     : game.join("saves");
   *   return { game, saves };
   * }
   * ```
   */
  paths(provider: StorePathProvider): Promise<GamePaths<"game" | T>>;

  /**
   * Declares how to detect the installed game version. The returned
   * {@link VersionSource} is a strategy descriptor executed by the
   * host, not the adaptor. This keeps adaptors OS-agnostic while
   * supporting common patterns like PE header reads or version files.
   *
   * @example
   * ```ts
   * async getVersionSource(paths) {
   *   const rehydrated = rehydrateGamePaths(paths);
   *   return peHeader(rehydrated.game.join("bin", "x64", "Game.exe"));
   * }
   * ```
   */
  getVersionSource?(paths: GamePaths<"game" | T>): Promise<VersionSource>;
}

/**
 * Reconstructs a {@link GamePaths} object after it has crossed an IPC
 * boundary. `structuredClone` preserves the plain-object shape but
 * strips {@link QualifiedPath} prototypes off the values; this helper
 * rebuilds them via {@link QualifiedPath.parse}.
 *
 * Adaptors call this at the top of methods that receive `GamePaths`
 * back from the host (e.g. {@link IGameToolsService.getGameTools}).
 *
 * @public */
export function rehydrateGamePaths<T extends string>(
  raw: GamePaths<T>,
): GamePaths<T> {
  const out: Record<string, QualifiedPath> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value instanceof QualifiedPath) {
      out[key] = value;
      continue;
    }
    const str = (value as { value?: string }).value;
    if (typeof str !== "string") {
      throw new Error(
        `rehydrateGamePaths: entry "${key}" is not a QualifiedPath`,
      );
    }
    out[key] = QualifiedPath.parse(str);
  }
  return out as GamePaths<T>;
}
