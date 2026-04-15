import { QualifiedPath } from "@vortex/fs";

import type { Base, StorePathSnapshot } from "../stores/providers.js";

/**
 * Path-map returned by an adaptor's {@link IGamePathService.paths}.
 *
 * The key space is `T` plus the mandatory {@link Base.Game} entry. `T`
 * is adaptor-declared; it can mix further {@link Base} values with
 * adaptor-specific string literals (e.g. `"creationKit"`, `"scripts"`).
 *
 * Values are concrete OS-scheme {@link QualifiedPath}s the adaptor
 * built from a {@link StorePathProvider} — the framework does not
 * resolve them further.
 *
 * @public */
export type GamePaths<T extends string = never> = Map<T | Base, QualifiedPath>;

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
   * Returns the full {@link GamePaths} map for the discovered game.
   *
   * The adaptor receives a {@link StorePathSnapshot} already scoped to
   * this discovery (store, host OS, game runtime OS, install path) and
   * wraps it via `createStorePathProvider` to get a
   * `StorePathProvider`. Every returned map must include a
   * {@link Base.Game} entry — the framework uses it to populate the
   * install directory.
   *
   * @example
   * ```ts
   * async paths(snapshot: StorePathSnapshot): Promise<GamePaths<"saves">> {
   *   const provider = createStorePathProvider(snapshot);
   *   const game = await provider.fromBase(Base.Game);
   *   const saves = provider.gameOS === OS.Windows
   *     ? (await provider.fromBase(Base.Home)).join("Saved Games", "My Game")
   *     : game.join("saves");
   *   return new Map([[Base.Game, game], ["saves", saves]]);
   * }
   * ```
   */
  paths(snapshot: StorePathSnapshot): Promise<GamePaths<T>>;
}

/**
 * Reconstructs a {@link GamePaths} Map after it has crossed an IPC
 * boundary. `structuredClone` preserves the `Map` itself but strips
 * {@link QualifiedPath} prototypes off the values; this helper rebuilds
 * them via {@link QualifiedPath.parse}.
 *
 * Adaptors call this at the top of methods that receive `GamePaths`
 * back from the host (e.g. {@link IGameToolsService.getGameTools}).
 *
 * @public */
export function rehydrateGamePaths<T extends string = never>(
  raw: ReadonlyMap<T | Base, QualifiedPath>,
): GamePaths<T> {
  const out = new Map<T | Base, QualifiedPath>();
  for (const [key, value] of raw) {
    if (value instanceof QualifiedPath) {
      out.set(key, value);
      continue;
    }
    const str = (value as { value?: string }).value;
    if (typeof str !== "string") {
      throw new Error(
        `rehydrateGamePaths: entry "${String(key)}" is not a QualifiedPath`,
      );
    }
    out.set(key, QualifiedPath.parse(str));
  }
  return out;
}
