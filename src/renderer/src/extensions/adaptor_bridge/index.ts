/**
 * Adaptor Bridge Extension
 *
 * This is the glue between the adaptor system (Workers in the main process)
 * and Vortex's renderer-side extension system (registerGame, registerModType,
 * registerInstaller, etc.).
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
 *   IGameModTypesService → called after paths resolve (needs GameFolderMap)
 *
 * ## Integration points
 *
 * - Store IDs → queryArgs for GameStoreHelper discovery
 * - GameFolderMap → mod type targetPaths and tool executable paths
 * - Stop patterns → game.details.stopPatterns for FOMOD installer
 * - Mod types → registerModType() with auto-computed priority ordering
 * - Tools → supportedTools array on the IGame object
 * - Installer → adaptor-aware installer using stop/file pattern matching
 */

import type { IExtensionContext } from "../../types/IExtensionContext";
import type { IInstruction } from "../mod_management/types/IInstallResult";

import Bluebird from "bluebird";

import { log } from "../../util/log";

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/**
 * Cache of resolved mod type definitions per game ID.
 * Populated during the game's setup callback (after discovery), and read
 * by the adaptor-aware installer when processing archives.
 */
const gameModTypeCache = new Map<string, GameModTypesInfo>();

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

interface ModType {
  name: string;
  targetPath: { value: string; path: string };
  /** Directory paths marking the mod root (e.g. "archive/pc/mod"). */
  stopPatterns: string[];
  /** Glob patterns for files belonging to this type (e.g. "*.archive"). */
  filePatterns?: string[];
  runsAfter?: string | string[];
  runsBefore?: string | string[];
  mergeMods?: boolean;
}

/** Map of type ID → ModType (e.g. { "archive": {...}, "cet": {...} }). */
type GameModTypesInfo = Record<string, ModType>;

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

/**
 * Converts plain directory-path stop patterns into the regex format
 * that the FOMOD installer expects. The FOMOD system uses these to
 * detect mod root boundaries in archive file listings.
 *
 * "r6/scripts" → "(^|/)r6/scripts(/|$)"
 *
 * The regex anchors ensure the pattern matches as a complete path
 * segment (not a substring of a longer path).
 */
function stopPatternsToRegex(patterns: string[]): string[] {
  return patterns.map(
    (dir) => `(^|/)${dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/|$)`,
  );
}

/**
 * Resolves runsAfter/runsBefore ordering into numeric priorities using
 * Kahn's topological sort algorithm.
 *
 * Adaptor authors declare ordering as names:
 *   tweaks: { runsAfter: ["cet", "redscript"] }
 *
 * Vortex's registerModType expects numeric priorities (higher = tested first).
 * This function bridges the gap — types with no dependencies get the highest
 * priority numbers, and types that depend on others get lower numbers.
 *
 * If there are cycles (A runsAfter B, B runsAfter A), the remaining types
 * get a fallback priority of 50.
 */
function computeOrderMap(
  modTypes: GameModTypesInfo,
): Record<string, number> {
  const ids = Object.keys(modTypes);
  const order: Record<string, number> = {};

  // Step 1: Build a dependency graph.
  // deps.get("tweaks") = Set(["cet", "redscript"]) means tweaks depends on cet and redscript
  const deps = new Map<string, Set<string>>();
  for (const id of ids) {
    deps.set(id, new Set());
  }

  for (const [id, mt] of Object.entries(modTypes)) {
    const after = mt.runsAfter
      ? Array.isArray(mt.runsAfter)
        ? mt.runsAfter
        : [mt.runsAfter]
      : [];
    const before = mt.runsBefore
      ? Array.isArray(mt.runsBefore)
        ? mt.runsBefore
        : [mt.runsBefore]
      : [];

    // "runsAfter: X" → this type depends on X (X must be tested first)
    for (const dep of after) {
      deps.get(id)?.add(dep);
    }
    // "runsBefore: X" → X depends on this type (this must be tested first)
    for (const dep of before) {
      deps.get(dep)?.add(id);
    }
  }

  // Step 2: Kahn's algorithm — process types with no remaining dependencies first.
  // In-degree = number of dependencies a node has (things it must wait for).
  const inDegree = new Map<string, number>();
  for (const [id, depSet] of deps) {
    inDegree.set(id, depSet.size);
  }

  // Seed the queue with types that have no dependencies
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  // Assign priorities in topological order (highest first)
  let priority = 100;
  while (queue.length > 0) {
    const id = queue.shift()!;
    order[id] = priority;
    priority -= 5;

    // Remove this type from the dependency sets of all other types
    for (const [otherId, depSet] of deps) {
      if (depSet.has(id)) {
        depSet.delete(id);
        const newDegree = (inDegree.get(otherId) ?? 1) - 1;
        inDegree.set(otherId, newDegree);
        if (newDegree === 0) queue.push(otherId);
      }
    }
  }

  // Any types still without an order have circular dependencies — give them
  // a safe middle-ground priority
  for (const id of ids) {
    if (!(id in order)) order[id] = 50;
  }

  return order;
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
 *    c. Mod types with stop patterns (IGameModTypesService)
 * 4. Register mod types and populate tools from the resolved data
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
  const modTypesUri = provides.find((u) => u.endsWith("/mod-types"));

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
  let cachedModTypes: GameModTypesInfo | null = null;

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

  /** Resolves mod types. Depends on folders being resolved first. */
  async function getModTypes(
    folders: GameFolderMap,
  ): Promise<GameModTypesInfo | null> {
    if (!cachedModTypes && modTypesUri) {
      cachedModTypes = (await callAdaptor(
        name,
        modTypesUri,
        "getModTypes",
        [folders],
      )) as GameModTypesInfo;
    }
    return cachedModTypes;
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

  // Mutable details object — populated at registration, updated in setup
  // when stop patterns become available. getStopPatterns() reads
  // game.details.stopPatterns, so mutations here are visible to it.
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

      // Step 2: Resolve tools and mod types in parallel (both depend on folders)
      const [tools, modTypes] = await Promise.all([
        getTools(folders),
        getModTypes(folders),
      ]);

      // Step 3: Wire the game executable from the tools service
      if (tools) {
        discovery.executable = tools.game.executable.path;
      }

      // Step 4: Register mod types with Vortex
      if (modTypes) {
        // Cache for the installer to use when processing archives
        gameModTypeCache.set(gameId, modTypes);

        // Convert runsAfter/runsBefore to numeric priorities
        const orderMap = computeOrderMap(modTypes);

        // Collect all stop patterns for FOMOD compatibility
        const allStopPatterns: string[] = [];

        for (const [typeId, modType] of Object.entries(modTypes)) {
          allStopPatterns.push(...modType.stopPatterns);

          context.registerModType(
            `${gameId}-${typeId}`,       // Unique ID: "cyberpunk2077-cet"
            orderMap[typeId] ?? 50,       // Computed priority from topo sort
            (gid) => gid === gameId,      // Only applies to this game
            () => modType.targetPath.path, // Deploy target (absolute path)

            // Test function: checks if install instructions contain files
            // matching this mod type's file patterns. Vortex calls this
            // after the installer runs to determine which mod type the
            // installed files belong to.
            (instructions) => {
              if (!modType.filePatterns?.length) return Bluebird.resolve(false);
              return Bluebird.resolve(
                instructions.some(
                  (i) =>
                    i.type === "copy" &&
                    i.destination !== undefined &&
                    modType.filePatterns!.some((pat) => {
                      if (pat.startsWith("*.")) {
                        return i.destination!.endsWith(pat.slice(1));
                      }
                      return i.destination!.includes(pat);
                    }),
                ),
              );
            },
            { mergeMods: modType.mergeMods ?? true },
          );
        }

        // Expose stop patterns in the standard location so the FOMOD
        // installer can find them via getStopPatterns(). The FOMOD system
        // reads game.details.stopPatterns to detect mod boundaries.
        gameDetails.stopPatterns = stopPatternsToRegex(allStopPatterns);
      }

      // Step 5: Populate supported tools
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
// Adaptor-aware mod installer
// ---------------------------------------------------------------------------

/**
 * Detects which mod type best matches the given archive file list by
 * checking stop patterns first (directory markers), then file patterns.
 *
 * Stop pattern matching: if the archive contains a file path like
 *   "SomeWrapper/r6/scripts/mymod/init.reds"
 * and the "redscript" mod type has stopPattern "r6/scripts", this
 * matches with rootPrefix "SomeWrapper/" — meaning we strip that
 * wrapper directory when extracting.
 *
 * File pattern matching: if no stop pattern matches but the archive
 * contains "*.reds" files and the "redscript" type has filePattern
 * "*.reds", it matches with no prefix stripping.
 *
 * Returns null if no mod type matches (falls through to basic installer).
 */
function detectModType(
  files: string[],
  gameId: string,
): { typeId: string; rootPrefix: string } | null {
  const modTypes = gameModTypeCache.get(gameId);
  if (!modTypes) return null;

  for (const [typeId, modType] of Object.entries(modTypes)) {
    // Priority 1: Check stop patterns (directory markers in the archive)
    for (const stopDir of modType.stopPatterns) {
      const normalizedStop = stopDir.replace(/\\/g, "/");
      for (const file of files) {
        const normalizedFile = file.replace(/\\/g, "/");
        const idx = normalizedFile.indexOf(normalizedStop);
        if (idx !== -1) {
          // Everything before the stop pattern is a wrapper to strip
          const rootPrefix = normalizedFile.slice(0, idx);
          return { typeId, rootPrefix };
        }
      }
    }

    // Priority 2: Check file extension patterns (e.g. "*.lua", "*.reds")
    if (modType.filePatterns?.length) {
      for (const file of files) {
        if (file.endsWith("/")) continue; // Skip directories
        for (const pat of modType.filePatterns) {
          if (pat.startsWith("*.") && file.endsWith(pat.slice(1))) {
            return { typeId, rootPrefix: "" };
          }
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Extension entry point
// ---------------------------------------------------------------------------

function init(context: IExtensionContext): boolean {
  // Register the adaptor-aware installer globally.
  // Priority 50 sits between FOMOD (100) and the basic installer (25),
  // so FOMOD archives are handled by the FOMOD system, but non-FOMOD
  // archives for adaptor-registered games get smart mod type detection
  // instead of the dumb copy-everything basic installer.
  context.registerInstaller(
    "adaptor-mod-installer",
    50,
    // testSupported: can we detect a mod type for this archive?
    async (files, gameId) => {
      const match = detectModType(files, gameId);
      return { supported: match !== null, requiredFiles: [] };
    },
    // install: strip wrapper directories and emit setmodtype instruction
    async (files, _destPath, gameId, progress) => {
      const match = detectModType(files, gameId);
      if (!match) {
        return { instructions: [] };
      }

      const { typeId, rootPrefix } = match;
      progress(0);

      // Build copy instructions, stripping the detected wrapper prefix
      const instructions: IInstruction[] = files
        .filter((f) => !f.endsWith("/")) // Skip directory entries
        .filter((f) => rootPrefix === "" || f.replace(/\\/g, "/").startsWith(rootPrefix))
        .map((f) => ({
          type: "copy" as const,
          source: f,
          destination: rootPrefix
            ? f.replace(/\\/g, "/").slice(rootPrefix.length)
            : f,
        }));

      // Tell Vortex which mod type this is — this determines the
      // deployment target directory (e.g. archive/pc/mod vs r6/scripts)
      instructions.push({
        type: "setmodtype",
        value: `${gameId}-${typeId}`,
      });

      progress(100);
      return { instructions };
    },
  );

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
