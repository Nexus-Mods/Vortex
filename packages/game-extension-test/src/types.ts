/**
 * Per-game opt-in descriptor exported as `testDescriptor` from each extension.
 */
export interface IGameExtensionTestDescriptor {
  /** Internal Vortex game id, matches the value passed to registerGame. */
  gameId: string;

  /** Nexus game-domain slug used when calling the Nexus API. */
  nexusGameDomain: string;

  fixtures: {
    mostPopular: number;
    mostRecent: number;
    oldest: number;
    allCollections: boolean;
    /**
     * When true, fetch *every* mod for the game via paginated GraphQL.
     * For small games this is fine; for large games (Skyrim, etc.) it
     * generates a lot of API traffic.
     */
    all: boolean;
  };

  /**
   * Maps a filename (matched by `path.basename`) to a generator that returns
   * the bytes/string to return when the installer reads that file.
   *
   * The generator receives a context object so different fixtures can produce
   * different content if needed.
   */
  syntheticContent: Record<string, (ctx: ISyntheticContext) => string | Buffer>;

  /**
   * Heuristics that classify fixtures as "not worth running through the
   * installer chain" (cheat tables, nested archives requiring prior
   * extraction, single instruction-text uploads, etc.).
   *
   * Evaluated after the manifest is fetched, before testSupported runs. If
   * any heuristic's `matches(files)` returns true, the fixture is reported as
   * skipped with the heuristic's reason and the installer chain is bypassed.
   */
  skipHeuristics?: ISkipHeuristic[];
}

export interface ISkipHeuristic {
  reason: string;
  matches: (files: string[]) => boolean;
}

export interface ISyntheticContext {
  /** Stable identifier derived from manifest's file_id (for use as mod id). */
  manifestId: string;
  modId: number;
  fileId: number;
}

/** A single fixture row resolved from the Nexus API. */
export interface IFixture {
  origin:
    | "all"
    | "mostPopular"
    | "mostRecent"
    | "oldest"
    | { type: "collection"; collectionId: string };
  modId: number;
  fileId: number;
  fileName: string;
  /** URL of the file's content-preview JSON (manifest endpoint). */
  contentPreviewLink: string;
  /** File-tree manifest (paths relative to archive root). Lazy-fetched. */
  manifest?: string[];
}

/** Outcome of running one fixture. */
export type FixtureOutcome =
  | { kind: "passed"; modCheckMessage: string }
  | { kind: "rejected"; reason: string }
  | { kind: "failed"; issues: string[] }
  | { kind: "skipped"; reason: string };

/**
 * Per-mod context passed to a healthcheck. Mirrors the framework's
 * IModCheckContext shape; kept here to avoid a cross-package import.
 */
export interface IModCheckContext {
  modId: string;
  files: string[];
  readFile: (path: string) => Promise<Buffer>;
  attributes: Record<string, unknown>;
}
