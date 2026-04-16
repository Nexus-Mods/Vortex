import type { RelativePath } from "@vortex/fs";

import { relativePath } from "@vortex/fs";

import type { StorePathProvider } from "../stores/providers.js";
import type { GamePaths } from "./game-paths.js";

import { compileGlob } from "./glob.js";

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
  readonly anchor: "game" | T;
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
   * The `context` argument is the same {@link StorePathProvider} that
   * `IGamePathService.paths()` receives, so store, baseOS, gameOS, and
   * base lookups are all accessible without a second RPC. The `paths`
   * argument is the same object previously returned by this adaptor's
   * `paths()` method; call {@link rehydrateGamePaths} on it if path
   * manipulation is needed, as it has crossed a structured-clone
   * boundary.
   *
   * Files that should not be deployed can be omitted from the output.
   * Adaptors that cannot handle the archive should throw; callers
   * decide fallback policy.
   *
   * @example
   * ```ts
   * async install(
   *   _context: StorePathProvider,
   *   _paths: GamePaths<"game" | "saves">,
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
    context: StorePathProvider,
    paths: GamePaths<"game" | T>,
    files: readonly RelativePath[],
  ): Promise<readonly InstallMapping<T>[]>;
}

// ---------------------------------------------------------------------------
// Declarative stop-pattern helper
//
// An opt-in utility for adaptor authors who prefer declaring a list of
// glob patterns over writing imperative routing logic inside install().
// See resolveStopPatterns() below.
// ---------------------------------------------------------------------------

/**
 * Context passed to a {@link StopPattern} `destination` function. Also
 * the field set available to `{placeholder}` substitutions in a
 * destination template string.
 *
 * @public */
export interface DestinationContext {
  /** The archive-relative source path that matched this pattern. */
  readonly source: RelativePath;
  /**
   * The portion of {@link source} that matched the stable (non-wrapper)
   * part of the pattern. Equals {@link source} when the pattern has no
   * wrapper prefix; otherwise it has the wrapping directories stripped.
   * This is the default destination when no explicit one is given.
   */
  readonly match: RelativePath;
  /** Last path component of {@link source}, including extension. */
  readonly basename: string;
  /** {@link basename} without its extension (if any). */
  readonly stem: string;
  /** Extension of {@link source} without the leading period, or `""`. */
  readonly ext: string;
}

/**
 * Glob-based routing rule mapping archive files to an anchor + path
 * under that anchor. Consumed by {@link resolveStopPatterns}.
 *
 * Supported glob syntax: `**`, `*`, `?`, and `{a,b,c}` alternation.
 * Matching is case-insensitive. A pattern that starts with `**<slash>`
 * is wrapper-tolerant and will match archives that add extra nesting
 * directories; without that prefix, the pattern must match the file
 * path from its start.
 *
 * When {@link destination} is omitted, the destination is the matched
 * stable suffix of the file path. When it is a string, it is treated
 * as a template with `{source}`, `{match}`, `{basename}`, `{stem}`,
 * `{ext}` placeholders. When it is a function, it returns the
 * destination directly from the {@link DestinationContext}.
 *
 * @public */
export interface StopPattern<T extends string = never> {
  /** Glob pattern tested against archive file paths. */
  readonly match: string;
  /** Anchor key into the adaptor's {@link GamePaths}. */
  readonly anchor: "game" | T;
  /** Optional explicit destination template or function. */
  readonly destination?: string | ((ctx: DestinationContext) => string);
}

/**
 * Applies {@link StopPattern}s to a file list and emits
 * {@link InstallMapping}s. Patterns are tried in the declared order;
 * the first match for each file wins. Files that match no pattern are
 * silently dropped.
 *
 * @public */
export function resolveStopPatterns<T extends string = never>(
  patterns: readonly StopPattern<T>[],
  files: readonly RelativePath[],
): readonly InstallMapping<T>[] {
  const compiled = patterns.map((p) => ({
    pattern: p,
    regex: compileGlob(p.match).regex,
  }));

  const out: InstallMapping<T>[] = [];
  for (const source of files) {
    for (const { pattern, regex } of compiled) {
      const m = regex.exec(source);
      if (!m) continue;
      const match = (m[1] ?? source) as RelativePath;
      const destination = computeDestination(pattern, source, match);
      out.push({ source, anchor: pattern.anchor, destination });
      break;
    }
  }
  return out;
}

function computeDestination<T extends string>(
  pattern: StopPattern<T>,
  source: RelativePath,
  match: RelativePath,
): RelativePath {
  if (pattern.destination === undefined) {
    return match;
  }
  const ctx: DestinationContext = {
    source,
    match,
    basename: basename(source),
    stem: stem(source),
    ext: ext(source),
  };
  const raw =
    typeof pattern.destination === "function"
      ? pattern.destination(ctx)
      : interpolate(pattern.destination, ctx);
  return relativePath(raw);
}

function interpolate(template: string, ctx: DestinationContext): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = (ctx as unknown as Record<string, string>)[key];
    if (typeof value !== "string") {
      throw new Error(`Unknown destination template placeholder: {${key}}`);
    }
    return value;
  });
}

function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

function stem(path: string): string {
  const b = basename(path);
  const i = b.lastIndexOf(".");
  return i <= 0 ? b : b.slice(0, i);
}

function ext(path: string): string {
  const b = basename(path);
  const i = b.lastIndexOf(".");
  return i <= 0 ? "" : b.slice(i + 1);
}
