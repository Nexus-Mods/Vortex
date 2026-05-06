/**
 * Adaptor Bridge Extension
 *
 * This is the glue between the adaptor system (Workers in the main process)
 * and Vortex's renderer-side extension system (registerGame, etc.).
 *
 * ## How it works
 *
 * 1. On startup, queries the main process for loaded adaptors via IPC.
 * 2. For each adaptor that provides game services, translates their
 *    declarative contract data into the imperative registration calls
 *    that Vortex's extension system expects.
 * 3. The rest of Vortex sees normal IGame/IModType/ITool data and has
 *    no idea it came from an adaptor Worker.
 *
 * ## Lazy resolution
 *
 * Adaptor services are resolved lazily — not at startup, but when the
 * game is first discovered and activated. This is intentional:
 * - It avoids blocking startup on adaptor IPC calls
 * - It supports Worker restarts (cached data can be invalidated)
 * - It means the adaptor only needs to be alive when its game is active
 *
 * The resolution chain is:
 *   IGameInfoService → called eagerly (needed for registerGame)
 *   IGamePathService → called on first discovery (setup callback)
 *   IGameToolsService → called after paths resolve (needs GamePaths)
 *
 * ## Integration points
 *
 * - Store IDs → queryArgs for GameStoreHelper discovery
 * - GamePaths → tool executable paths
 * - Tools → supportedTools array on the IGame object
 */

import Bluebird from "bluebird"; // Used for setup callback return type
import * as path from "path";

import type { IExtensionContext } from "../../types/IExtensionContext";
import type { IInstruction } from "../../extensions/mod_management/types/IInstallResult";

import { log } from "../../util/log";

// ---------------------------------------------------------------------------
// Type definitions for adaptor IPC responses
//
// These mirror the adaptor contract types but use plain objects instead of
// class instances (QualifiedPath is structured-cloned into a plain object
// when crossing the IPC boundary). The bridge forwards these blobs back
// into the adaptor untouched; only the adaptor rebuilds QualifiedPaths.
// ---------------------------------------------------------------------------

interface AdaptorEntry {
  name: string;
  pid: string;
  provides: string[]; // URIs like "vortex:adaptor/cyberpunk2077/info"
  requires: string[];
  gameInfo?: GameInfo | null;
}

/** Serialized form of GameInfo from IGameInfoService. */
interface GameInfo {
  gameUri: string;
  displayName: string;
  steam?: Array<{ appId: number; name?: string }>;
  epic?: Array<{ catalogNamespace: string; name?: string }>;
  gog?: Array<{ gameId: number; name?: string }>;
  xbox?: Array<{ packageFamilyName: string; name?: string }>;
  nexusMods?: Array<{ domain: string; name?: string }>;
}

/**
 * Opaque snapshot returned by `adaptors:build-snapshot`. The renderer
 * treats this as an opaque blob: it goes straight into `paths()` as
 * an argument, and the worker dispatch layer wraps it into a
 * `StorePathProvider` before the adaptor method is called.
 */
type OpaqueStorePathSnapshot = unknown;

/**
 * Opaque `GamePaths` blob returned by `IGamePathService.paths`. The
 * renderer forwards it into `getGameTools` without inspecting it; the
 * receiving adaptor calls `rehydrateGamePaths` to turn it back into a
 * Map of real QualifiedPaths.
 */
type OpaqueGamePaths = unknown;

interface GameExecutable {
  executable: { value: string; path: string };
  parameters?: string[];
  environment?: Record<string, string>;
}

interface ToolEntry {
  executable: { value: string; path: string };
  name: string;
  shortName?: string;
  parameters?: string[];
  environment?: Record<string, string>;
  requiredFiles?: Array<{ path: string }>;
  exclusive?: boolean;
  defaultPrimary?: boolean;
  shell?: boolean;
  detach?: boolean;
  onStart?: "hide" | "hide_recover" | "close";
}

interface GameToolsInfo {
  game: GameExecutable;
  tools?: Record<string, ToolEntry>;
}

/**
 * Serialized form of `InstallMapping<T>` from `IGameInstallerService`.
 * `anchor` is left as `string` here because the bridge is agnostic to
 * the adaptor's extra-key space `T`. Only consumers that know the
 * adaptor's type parameter can narrow it further.
 */
export interface InstallMapping {
  source: string;
  anchor: string;
  destination: string;
}

type InstallerDispatch = (
  files: readonly string[],
) => Promise<readonly InstallMapping[]>;

/**
 * Registry of per-game mod-installer dispatch functions, populated as
 * adaptors are discovered and their `setup()` callback runs. Keyed by
 * game ID. Reads the same cached paths + snapshot the bridge already
 * tracks, so callers outside the bridge (e.g. a future InstallManager
 * integration) don't need to re-resolve them. The registry itself is
 * module-private; consumers go through the exported accessors below.
 */
const installerRegistry = new Map<string, InstallerDispatch>();

/**
 * Detected game versions from adaptor version sources, keyed by game ID.
 * Populated during the setup callback when an adaptor declares a
 * `getVersionSource` method on its paths service.
 */
const detectedVersions = new Map<string, string>();

/** Returns the installer dispatch for a game, or `undefined`. */
export function getAdaptorInstaller(
  gameId: string,
): InstallerDispatch | undefined {
  return installerRegistry.get(gameId);
}

/** Returns the set of game IDs that currently have an adaptor installer. */
export function adaptorInstallerGameIds(): readonly string[] {
  return [...installerRegistry.keys()];
}

/**
 * Validates that an adaptor's `install()` reply matches the
 * {@link InstallMapping} shape before we hand it to any consumer.
 * A misbehaving adaptor shouldn't be able to surface as a crash in
 * downstream code that trusted the cast.
 */
function assertInstallMappings(
  value: unknown,
  adaptorName: string,
): readonly InstallMapping[] {
  if (!Array.isArray(value)) {
    throw new Error(
      `[adaptor-bridge] ${adaptorName}: installer returned non-array`,
    );
  }
  for (const entry of value) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as { source?: unknown }).source !== "string" ||
      typeof (entry as { anchor?: unknown }).anchor !== "string" ||
      typeof (entry as { destination?: unknown }).destination !== "string"
    ) {
      throw new Error(
        `[adaptor-bridge] ${adaptorName}: installer returned malformed mapping`,
      );
    }
  }
  return value as readonly InstallMapping[];
}

// ---------------------------------------------------------------------------
// IPC helpers
// ---------------------------------------------------------------------------

/**
 * Calls an adaptor service method via the preload IPC bridge.
 * This crosses the renderer → main process boundary, dispatches to the
 * named adaptor's Worker, and returns the serialized result.
 */
async function callAdaptor(
  adaptorName: string,
  serviceUri: string,
  method: string,
  args: unknown[] = [],
): Promise<unknown> {
  return window.api.adaptors.call(adaptorName, serviceUri, method, args);
}

// ---------------------------------------------------------------------------
// Data transformation helpers
// ---------------------------------------------------------------------------

/** Serialized QualifiedPath shape as it appears after IPC structured-clone. */
interface SerializedQP {
  value: string;
  scheme: string;
  path: string;
}

/**
 * Converts a serialized QualifiedPath's URI-style `.path` component to a
 * native filesystem path. Windows paths are encoded as `/C/Users/foo` in
 * the QP and need to become `C:\Users\foo`; Linux paths are already native.
 *
 * NOTE: paths that don't match the `/X/...` drive-letter pattern (e.g. UNC
 * paths or bare relative segments) fall through to a simple slash-flip.
 * This is intentional — QualifiedPath always produces the `/X/...` form
 * for local drives, so the fallback is a defensive catch-all rather than
 * an expected code path.
 *
 * TODO: replace with `resolveAbsolutePath` from `@nexusmods/adaptor-api/fs` once the
 * browser-side path resolver lands.
 */
function qpPathToNative(qp: SerializedQP): string {
  if (qp.scheme === "windows") {
    const p = qp.path;
    if (p.length >= 3 && p[0] === "/" && p[2] === "/") {
      return p[1] + ":" + p.slice(2).replace(/\//g, "\\");
    }
    return p.replace(/\//g, "\\");
  }
  return qp.path;
}

/**
 * Extracts a game ID from a game URI.
 * "game:cyberpunk2077" → "cyberpunk2077"
 */
function gameIdFromUri(gameUri: string): string {
  return gameUri.startsWith("game:") ? gameUri.slice(5) : gameUri;
}

/**
 * Converts adaptor store IDs into the queryArgs format that Vortex's
 * GameStoreHelper understands. This is how Vortex discovers installed
 * games on disk — it queries Steam, Epic, GOG, etc. with these IDs.
 *
 * Example: { steam: [{ appId: 1091500 }] } → { steam: [{ id: "1091500" }] }
 */
function buildQueryArgs(
  info: GameInfo,
): Record<string, Array<{ id?: string; name?: string; prefer?: number }>> {
  const args: Record<
    string,
    Array<{ id?: string; name?: string; prefer?: number }>
  > = {};

  // prefer values enforce ordering: Steam > GOG > Epic > Xbox
  if (info.steam?.length) {
    args.steam = info.steam.map((s) => ({ id: String(s.appId), prefer: 0 }));
  }
  if (info.gog?.length) {
    args.gog = info.gog.map((g) => ({ id: String(g.gameId), prefer: 1 }));
  }
  if (info.epic?.length) {
    args.epic = info.epic.map((e) => ({ id: e.catalogNamespace, prefer: 2 }));
  }
  if (info.xbox?.length) {
    args.xbox = info.xbox.map((x) => ({ id: x.packageFamilyName, prefer: 3 }));
  }

  return args;
}

// ---------------------------------------------------------------------------
// Per-adaptor registration
// ---------------------------------------------------------------------------

/**
 * Registers a single game adaptor into the Vortex extension system.
 *
 * This is the core of the bridge: it takes an adaptor's manifest and
 * translates its declarative contract data into the imperative
 * registerGame/registerModType calls that Vortex understands.
 *
 * This function is called synchronously during `init()` so that
 * `registerGame` runs before `endRegistration`. Game info is
 * pre-fetched by the main process and passed in via the adaptor entry.
 *
 * The flow is:
 * 1. Use pre-fetched game info (needed for registerGame)
 * 2. Register the game with queryArgs for store discovery
 * 3. In the setup callback (called after discovery), lazily resolve:
 *    a. Game folder paths (IGamePathService)
 *    b. Tools and executable info (IGameToolsService)
 *    c. Populate supported tools from the resolved data
 */
function registerAdaptor(
  context: IExtensionContext,
  adaptor: AdaptorEntry,
): void {
  const { name, provides } = adaptor;

  // Match adaptor service URIs by the exact "vortex:adaptor/{id}/{service}"
  // convention.  A full regex avoids false positives from URIs that merely
  // happen to end with the service name.
  const findService = (service: string): string | undefined =>
    provides.find((u) =>
      new RegExp(`^vortex:adaptor/[^/]+/${service}$`).test(u),
    );

  const infoUri = findService("info");
  const pathsUri = findService("paths");
  const toolsUri = findService("tools");
  const installerUri = findService("installer");

  // An adaptor must at least provide game info to be a game adaptor
  if (!infoUri) return;

  // Game info was pre-fetched by the main process during adaptor load
  const info = adaptor.gameInfo as GameInfo | null;
  if (!info) return;

  const gameId = gameIdFromUri(info.gameUri);

  log("info", "[adaptor-bridge] Registering game: {{gameId}} ({{name}})", {
    gameId,
    name: info.displayName,
  });

  // --- Lazy resolution closures ---
  // These cache the results of adaptor service calls so we only
  // cross the IPC boundary once per service per session. They get
  // reset at the top of setup() to handle re-discovery.

  let pathsResolved = false;
  let cachedSnapshot: OpaqueStorePathSnapshot | null = null;
  let cachedPaths: OpaqueGamePaths | null = null;
  let cachedTools: GameToolsInfo | null = null;

  // An adaptor with a tools service but no paths service is a manifest
  // error: getGameTools takes a GamePaths argument, and we have nothing
  // sensible to pass. Skip tools registration in that case rather than
  // invoking the adaptor with `null`.
  if (toolsUri && !pathsUri) {
    log(
      "warn",
      "[adaptor-bridge] Adaptor {{name}} provides tools but no paths service; tools will be ignored",
      { name },
    );
  }

  // Same invariant for the installer service: install() takes the
  // GamePaths returned by paths(), so a manifest without a paths URI
  // has nothing to feed it.
  if (installerUri && !pathsUri) {
    log(
      "warn",
      "[adaptor-bridge] Adaptor {{name}} provides installer but no paths service; installer will be ignored",
      { name },
    );
  }

  /** Resolves game paths. Called once after discovery. */
  async function getPaths(
    store: string,
    gamePath: string,
  ): Promise<OpaqueGamePaths | null> {
    if (!pathsResolved && pathsUri) {
      cachedSnapshot = await window.api.adaptors.buildSnapshot(store, gamePath);
      cachedPaths = await callAdaptor(name, pathsUri, "paths", [
        cachedSnapshot,
      ]);
      pathsResolved = true;
    }
    return cachedPaths;
  }

  /**
   * Resolves game tools. Requires paths to have resolved first. Returns
   * `null` if the adaptor provides no tools service or if paths were
   * unavailable (we never call `getGameTools` with a `null` paths arg).
   */
  async function getTools(
    paths: OpaqueGamePaths | null,
  ): Promise<GameToolsInfo | null> {
    if (!toolsUri || paths === null) return null;
    if (!cachedTools) {
      cachedTools = (await callAdaptor(name, toolsUri, "getGameTools", [
        paths,
      ])) as GameToolsInfo;
    }
    return cachedTools;
  }

  /**
   * Detects the game version using the adaptor's declared strategy.
   * Calls `getVersionSource` on the paths service, then sends the
   * resulting descriptor to the main process for execution.
   * Returns null if the adaptor doesn't declare version detection.
   */
  async function getVersion(
    paths: OpaqueGamePaths | null,
  ): Promise<string | null> {
    if (!pathsUri || paths === null) return null;
    try {
      const source = await callAdaptor(name, pathsUri, "getVersionSource", [
        paths,
      ]);
      if (!source || typeof source !== "object") return null;
      return await window.api.adaptors.detectVersion(
        source as { type: string; path: { value: string }; regex?: string },
      );
    } catch {
      // getVersionSource is optional; adaptor may not implement it
      return null;
    }
  }

  /**
   * Dispatches the per-archive installer call to the adaptor. Must be
   * called after paths have resolved, so the installer can be fed the
   * same snapshot (the shared context) and the resolved GamePaths blob,
   * both forwarded opaquely. Returns an empty array when the adaptor
   * does not declare an installer service.
   */
  async function invokeInstaller(
    files: readonly string[],
  ): Promise<readonly InstallMapping[]> {
    if (!installerUri || !pathsUri) return [];
    if (!cachedSnapshot || !cachedPaths) {
      throw new Error(
        `[adaptor-bridge] ${name}: installer called before paths resolved`,
      );
    }
    const raw = await callAdaptor(name, installerUri, "install", [
      cachedSnapshot,
      cachedPaths,
      files,
    ]);
    return assertInstallMappings(raw, name);
  }

  // The supportedTools array is passed by reference to registerGame and
  // populated later in the setup callback once tools are resolved.
  // This works because Vortex reads supportedTools lazily (when the game
  // is activated), not at registration time.
  const supportedTools: Array<{
    id: string;
    name: string;
    shortName?: string;
    executable: () => string;
    requiredFiles: string[];
    parameters?: string[];
    environment?: Record<string, string>;
    exclusive?: boolean;
    defaultPrimary?: boolean;
    shell?: boolean;
    detach?: boolean;
    onStart?: "hide" | "hide_recover" | "close";
    relative: boolean;
  }> = [];

  // Placeholder until the tools service resolves the real executable
  // path after discovery. Updated in the setup callback.
  let resolvedExecutable = ".";

  const gameDetails: Record<string, unknown> = {
    steamAppId: info.steam?.[0]?.appId,
    nexusPageId: info.nexusMods?.[0]?.domain,
  };

  // --- Register the game ---
  context.registerGame({
    id: gameId,
    name: info.displayName,
    executable: () => resolvedExecutable,
    requiredFiles: [], // Adaptors don't use file-based discovery
    mergeMods: true,
    queryModPath: () => ".", // Actual paths come from mod type registrations
    queryArgs: buildQueryArgs(info), // Enables GameStoreHelper discovery
    supportedTools,
    environment: {},
    details: gameDetails,

    /**
     * Setup callback — called by Vortex after the game is discovered on disk.
     * This is where we lazily resolve all adaptor services, because now we
     * have a concrete install path and store to work with.
     *
     * Resolution chain: paths → tools + mod types (both need paths)
     */
    setup: (discovery) =>
      Bluebird.resolve(
        (async () => {
          // Invalidate caches on re-discovery (install moved, different store).
          pathsResolved = false;
          cachedSnapshot = null;
          cachedPaths = null;
          cachedTools = null;
          installerRegistry.delete(gameId);

          const store = discovery.store ?? "unknown";
          const gamePath = discovery.path;
          if (!gamePath) {
            log(
              "warn",
              `[adaptor-bridge] No discovery path for ${name}, skipping setup`,
            );
            return;
          }

          // Step 1: Resolve folder paths (game, saves, preferences, etc.)
          const paths = await getPaths(store, gamePath);

          // Step 2: Detect game version (if adaptor declares a strategy)
          const version = await getVersion(paths);
          if (version && version !== "0.0.0") {
            detectedVersions.set(gameId, version);
            log(
              "info",
              "[adaptor-bridge] {{gameId}} version: {{version}}",
              { gameId, version },
            );
          }

          // Step 3: Resolve tools (depends on paths)
          const tools = await getTools(paths);

          // Step 4: Wire the game executable from the tools service.
          // The executable is a QualifiedPath; .path gives the
          // relative portion within its anchor (per-store resolved).
          if (tools?.game?.executable?.path) {
            resolvedExecutable = tools.game.executable.path;
            discovery.executable = resolvedExecutable;
          }

          // Step 5: Populate supported tools (additional launchers, etc.)
          if (tools?.tools) {
            for (const [toolId, tool] of Object.entries(tools.tools)) {
              supportedTools.push({
                id: `${gameId}-${toolId}`,
                name: tool.name,
                shortName: tool.shortName,
                executable: () => tool.executable.path,
                requiredFiles: (tool.requiredFiles ?? []).map((f) => f.path),
                parameters: tool.parameters,
                environment: tool.environment,
                exclusive: tool.exclusive,
                defaultPrimary: tool.defaultPrimary,
                shell: tool.shell,
                detach: tool.detach,
                onStart: tool.onStart,
                relative: true, // Always relative to game folder
              });
            }
          }

          // Step 6: Register mod types for non-game anchors so the
          // deployment system knows where to route files that target
          // saves, preferences, or other adaptor-declared directories.
          if (paths !== null) {
            for (const [anchor, qp] of Object.entries(
              paths as Record<string, unknown>,
            )) {
              if (anchor === "game") continue;
              if (
                typeof qp !== "object" ||
                qp === null ||
                typeof (qp as SerializedQP).scheme !== "string" ||
                typeof (qp as SerializedQP).path !== "string"
              ) {
                log(
                  "warn",
                  "[adaptor-bridge] {{name}}: skipping non-QP paths entry {{anchor}}",
                  { name, anchor },
                );
                continue;
              }
              const modTypeId = `${gameId}-${anchor}`;
              const nativePath = qpPathToNative(qp as SerializedQP);
              context.registerModType(
                modTypeId,
                50,
                (gId) => gId === gameId,
                () => nativePath,
                () => Bluebird.resolve(false),
              );
            }
          }

          // Step 7: Expose the installer dispatch so the registered
          // "adaptor" installer can route archive contents through the
          // adaptor's stop-pattern resolver.
          if (installerUri && pathsUri && paths !== null) {
            installerRegistry.set(gameId, invokeInstaller);
          }
        })(),
      ),
  });
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

function init(context: IExtensionContext): boolean {
  // Register a version provider for adaptor-managed games. Priority 15
  // sits before the built-in ext-version-check (20) and exec-version-check
  // (100), so adaptor-detected versions take precedence.
  context.registerGameVersionProvider(
    "adaptor-version",
    15,
    (game) => Promise.resolve(detectedVersions.has(game.id)),
    (game) => Promise.resolve(detectedVersions.get(game.id) ?? "0.0.0"),
  );

  // Register a single installer that delegates to whichever adaptor owns
  // the active game. Priority 25 sits after both fomod installers (native
  // at 10, IPC at 20) so fomod archives still get fomod treatment, but
  // before the generic fallback (1000).
  context.registerInstaller(
    "adaptor",
    25,
    (_files, gameId) => {
      const supported = getAdaptorInstaller(gameId) !== undefined;
      return Promise.resolve({ supported, requiredFiles: [] });
    },
    async (files, _destinationPath, gameId) => {
      const dispatch = getAdaptorInstaller(gameId);
      if (dispatch === undefined) {
        throw new Error(
          `[adaptor-bridge] No adaptor installer registered for game "${gameId}"`,
        );
      }
      // InstallManager's buildFileList produces backslash-separated paths
      // on Windows and appends path.sep to directory entries. Adaptors
      // expect forward-slash RelativePaths with no trailing separator, so
      // normalize here and filter out directory entries.
      const normalized = files
        .filter((f) => !f.endsWith("/") && !f.endsWith("\\"))
        .map((f) => f.replace(/\\/g, "/"));
      const mappings = await dispatch(normalized);
      if (mappings.length === 0) {
        throw new Error(
          `[adaptor-bridge] Adaptor returned no install mappings for game "${gameId}"`,
        );
      }
      const instructions: IInstruction[] = mappings.map((m) => ({
        type: "copy" as const,
        source: m.source,
        destination: m.destination,
      }));

      // Determine the mod type from the anchor field. A single mod can
      // only target one mod type in Vortex, so mixed anchors are an error.
      const anchors = new Set(mappings.map((m) => m.anchor));
      if (anchors.size > 1) {
        throw new Error(
          `[adaptor-bridge] Mod targets multiple anchors (${[...anchors].join(", ")}); ` +
            "a single mod can only deploy to one location",
        );
      }
      const anchor = [...anchors][0];
      if (anchor !== undefined && anchor !== "game") {
        instructions.push({
          type: "setmodtype",
          value: `${gameId}-${anchor}`,
        });
      }

      return { instructions };
    },
  );

  // Register all loaded adaptors synchronously during init so that
  // registerGame calls happen before endRegistration. The adaptor
  // list and pre-fetched game info come from a synchronous IPC call.
  try {
    const adaptors = window.api.adaptors.listWithInfoSync() as AdaptorEntry[];

    if (adaptors.length === 0) {
      log("info", "[adaptor-bridge] No adaptors loaded");
    } else {
      log("info", "[adaptor-bridge] Found {{count}} adaptor(s)", {
        count: adaptors.length,
      });

      for (const adaptor of adaptors) {
        try {
          registerAdaptor(context, adaptor);
        } catch (err) {
          log(
            "warn",
            "[adaptor-bridge] Failed to register adaptor {{name}}: {{error}}",
            {
              name: adaptor.name,
              error: err instanceof Error ? err.message : "Unknown error",
            },
          );
        }
      }
    }
  } catch (err) {
    log("error", "[adaptor-bridge] Failed to query adaptors: {{error}}", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }

  return true;
}

export default init;
