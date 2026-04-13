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
 *   IGameToolsService → called after paths resolve (needs GameFolderMap)
 *
 * ## Integration points
 *
 * - Store IDs → queryArgs for GameStoreHelper discovery
 * - GameFolderMap → tool executable paths
 * - Tools → supportedTools array on the IGame object
 */

import type { IExtensionContext } from "../../types/IExtensionContext";

import Bluebird from "bluebird"; // Used for setup callback return type

import { log } from "../../util/log";

// ---------------------------------------------------------------------------
// Type definitions for adaptor IPC responses
//
// These mirror the adaptor contract types but use plain objects instead of
// class instances (QualifiedPath is serialized to { value, scheme, path }
// when crossing the IPC boundary).
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

/** Serialized QualifiedPath objects become plain objects over IPC. */
interface GameFolderMap {
  [key: string]: { value: string; scheme: string; path: string };
}

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

  // An adaptor must at least provide game info to be a game adaptor
  if (!infoUri) return;

  // Fetch game info eagerly — we need the game ID and store IDs
  // for registerGame which must happen synchronously during init
  const info = (await callAdaptor(
    name,
    infoUri,
    "getGameInfo",
  )) as GameInfo;

  const gameId = gameIdFromUri(info.gameUri);

  log("info", "[adaptor-bridge] Registering game: {{gameId}} ({{name}})", {
    gameId,
    name: info.displayName,
  });

  // --- Lazy resolution closures ---
  // These cache the results of adaptor service calls so we only
  // cross the IPC boundary once per service per session.

  let cachedFolders: GameFolderMap | null = null;
  let cachedTools: GameToolsInfo | null = null;

  /** Resolves game folder paths. Called once after discovery. */
  async function getFolders(
    store: string,
    gamePath: string,
  ): Promise<GameFolderMap> {
    if (!cachedFolders && pathsUri) {
      cachedFolders = (await callAdaptor(name, pathsUri, "resolveGameFolders", [
        store,
        gamePath,
      ])) as GameFolderMap;
    }
    return cachedFolders ?? {};
  }

  /** Resolves game tools. Depends on folders being resolved first. */
  async function getTools(
    folders: GameFolderMap,
  ): Promise<GameToolsInfo | null> {
    if (!cachedTools && toolsUri) {
      cachedTools = (await callAdaptor(name, toolsUri, "getGameTools", [
        folders,
      ])) as GameToolsInfo;
    }
    return cachedTools;
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
    logo: "",              // TODO: adaptor-provided logo
    executable: () => ".", // Placeholder — updated in setup after tools resolve
    requiredFiles: [],     // Adaptors don't use file-based discovery
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
     * Resolution chain: paths → tools + mod types (both need folders)
     */
    setup: (discovery) => Bluebird.resolve((async () => {
      const store = discovery.store ?? "unknown";
      const gamePath = discovery.path;
      if (!gamePath) {
        log("warn", `[adaptor-bridge] No discovery path for ${name}, skipping setup`);
        return;
      }

      // Step 1: Resolve folder paths (install, saves, config, etc.)
      const folders = await getFolders(store, gamePath);

      // Step 2: Resolve tools (depends on folders)
      const tools = await getTools(folders);

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
    })()),
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
