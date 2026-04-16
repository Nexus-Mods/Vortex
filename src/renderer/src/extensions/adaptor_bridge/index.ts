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

import type { IExtensionContext } from "../../types/IExtensionContext";

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
): Record<string, Array<{ id?: string; name?: string }>> {
  const args: Record<string, Array<{ id?: string; name?: string }>> = {};

  if (info.steam?.length) {
    args.steam = info.steam.map((s) => ({ id: String(s.appId) }));
  }
  if (info.epic?.length) {
    args.epic = info.epic.map((e) => ({ id: e.catalogNamespace }));
  }
  if (info.gog?.length) {
    args.gog = info.gog.map((g) => ({ id: String(g.gameId) }));
  }
  if (info.xbox?.length) {
    args.xbox = info.xbox.map((x) => ({ id: x.packageFamilyName }));
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
 * The flow is:
 * 1. Fetch game info eagerly (needed for registerGame)
 * 2. Register the game with queryArgs for store discovery
 * 3. In the setup callback (called after discovery), lazily resolve:
 *    a. Game folder paths (IGamePathService)
 *    b. Tools and executable info (IGameToolsService)
 * 4. Populate tools from the resolved data
 */
async function registerAdaptor(
  context: IExtensionContext,
  adaptor: AdaptorEntry,
): Promise<void> {
  const { name, provides } = adaptor;

  // Match adaptor service URIs by their suffix convention.
  // e.g. "vortex:adaptor/cyberpunk2077/info" ends with "/info"
  const infoUri = provides.find((u) => u.endsWith("/info"));
  const pathsUri = provides.find((u) => u.endsWith("/paths"));
  const toolsUri = provides.find((u) => u.endsWith("/tools"));
  const installerUri = provides.find((u) => u.endsWith("/installer"));

  // An adaptor must at least provide game info to be a game adaptor
  if (!infoUri) return;

  // Fetch game info eagerly — we need the game ID and store IDs
  // for registerGame which must happen synchronously during init
  const info = (await callAdaptor(name, infoUri, "getGameInfo")) as GameInfo;

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

  const gameDetails: Record<string, unknown> = {
    steamAppId: info.steam?.[0]?.appId,
    nexusPageId: info.nexusMods?.[0]?.domain,
  };

  // --- Register the game ---
  context.registerGame({
    id: gameId,
    name: info.displayName,
    logo: "", // TODO: adaptor-provided logo
    executable: () => ".", // Placeholder — updated in setup after tools resolve
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

          // Step 2: Resolve tools (depends on paths)
          const tools = await getTools(paths);

          // Step 3: Wire the game executable from the tools service
          if (tools) {
            discovery.executable = tools.game.executable.path;
          }

          // Step 4: Populate supported tools
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

          // Step 5: Expose the installer dispatch so later callers
          // (e.g. InstallManager integration, in a follow-up PR) can
          // route archive contents through the adaptor. Only registered
          // when the adaptor declares both /paths and /installer URIs.
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
  // On startup, discover and register all loaded adaptors.
  // context.once() runs after all extensions are initialized but before
  // the UI is fully interactive — the right time to register games.
  context.once(async () => {
    try {
      const adaptors = await window.api.adaptors.list();

      if (adaptors.length === 0) {
        log("info", "[adaptor-bridge] No adaptors loaded");
        return;
      }

      log("info", "[adaptor-bridge] Found {{count}} adaptor(s)", {
        count: adaptors.length,
      });

      for (const adaptor of adaptors) {
        try {
          await registerAdaptor(context, adaptor);
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
    } catch (err) {
      log("error", "[adaptor-bridge] Failed to query adaptors: {{error}}", {
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });

  return true;
}

export default init;
