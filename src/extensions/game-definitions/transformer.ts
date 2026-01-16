import Promise from "bluebird";

import type { IGame } from "../../types/IGame";
import type { ITool } from "../../types/ITool";

import type {
  GameDef,
  GameDefStores,
  GameDefTool,
  IGameCustomLogic,
} from "./types";

/**
 * Builds queryArgs from store IDs for game discovery.
 *
 * @param stores - Store identifiers from the game definition
 * @param registryPath - Optional registry path for Windows discovery
 * @returns Query arguments object for game discovery
 */
function buildQueryArgs(
  stores?: GameDefStores,
  registryPath?: string,
): { [storeId: string]: Array<{ id?: string; name?: string }> } | undefined {
  if (!stores && !registryPath) {
    return undefined;
  }

  const args: { [storeId: string]: Array<{ id?: string; name?: string }> } = {};

  if (stores?.steam) {
    args.steam = [{ id: stores.steam }];
  }
  if (stores?.gog) {
    args.gog = [{ id: stores.gog }];
  }
  if (stores?.epic) {
    args.epic = [{ id: stores.epic }];
  }
  if (stores?.xbox) {
    args.xbox = [{ id: stores.xbox }];
  }
  if (registryPath) {
    args.registry = [{ id: registryPath }];
  }

  return Object.keys(args).length > 0 ? args : undefined;
}

/**
 * Builds the details object from store IDs and other metadata.
 *
 * @param stores - Store identifiers from the game definition
 * @param nexusPageId - Nexus Mods page ID
 * @param hashFiles - Files used for hash-based version detection
 * @returns Details object for the game
 */
function buildDetails(
  stores?: GameDefStores,
  nexusPageId?: string,
  hashFiles?: string[],
): { [key: string]: any } | undefined {
  const details: { [key: string]: any } = {};

  if (stores?.steam) {
    details.steamAppId = parseInt(stores.steam, 10);
  }
  if (stores?.gog) {
    details.gogAppId = stores.gog;
  }
  if (stores?.epic) {
    details.epicAppId = stores.epic;
  }
  if (stores?.xbox) {
    details.xboxAppId = stores.xbox;
  }
  if (nexusPageId) {
    details.nexusPageId = nexusPageId;
  }
  if (hashFiles && hashFiles.length > 0) {
    details.hashFiles = hashFiles;
  }

  return Object.keys(details).length > 0 ? details : undefined;
}

/**
 * Builds environment variables with store ID interpolation.
 *
 * @param env - Environment variable definitions from YAML
 * @param stores - Store identifiers for interpolation
 * @returns Environment variables object
 */
function buildEnvironment(
  env?: Array<{ var: string; value: string }>,
  stores?: GameDefStores,
): { [key: string]: string } | undefined {
  if (!env || env.length === 0) {
    // Auto-generate environment from stores if no explicit environment
    if (stores) {
      const autoEnv: { [key: string]: string } = {};
      if (stores.steam) {
        autoEnv.SteamAPPId = stores.steam;
      }
      if (stores.gog) {
        autoEnv.GogAPPId = stores.gog;
      }
      if (stores.epic) {
        autoEnv.EpicAPPId = stores.epic;
      }
      if (stores.xbox) {
        autoEnv.XboxAPPId = stores.xbox;
      }
      return Object.keys(autoEnv).length > 0 ? autoEnv : undefined;
    }
    return undefined;
  }

  const result: { [key: string]: string } = {};

  for (const { var: key, value } of env) {
    let resolved = value;

    if (stores?.steam) {
      resolved = resolved.replace(/\$steam/g, stores.steam);
    }
    if (stores?.gog) {
      resolved = resolved.replace(/\$gog/g, stores.gog);
    }
    if (stores?.epic) {
      resolved = resolved.replace(/\$epic/g, stores.epic);
    }
    if (stores?.xbox) {
      resolved = resolved.replace(/\$xbox/g, stores.xbox);
    }

    result[key] = resolved;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Builds the requiresLauncher function based on available stores.
 *
 * @param stores - Store identifiers from the game definition
 * @returns A requiresLauncher function or undefined
 */
function buildRequiresLauncher(
  stores?: GameDefStores,
):
  | ((
      gamePath: string,
      store?: string,
    ) => Promise<{ launcher: string; addInfo?: any } | undefined>)
  | undefined {
  if (!stores) {
    return undefined;
  }

  // Only generate requiresLauncher if there are non-steam stores that need steam
  // or if there are xbox/epic stores that need their own launchers
  const hasMultipleStores =
    Object.keys(stores).filter((k) => stores[k as keyof GameDefStores]).length >
    1;

  if (!hasMultipleStores && !stores.xbox && !stores.epic) {
    return undefined;
  }

  return (
    _gamePath: string,
    store?: string,
  ): Promise<{ launcher: string; addInfo?: any } | undefined> => {
    // Xbox store
    if (store === "xbox" && stores.xbox) {
      return Promise.resolve({
        launcher: "xbox",
        addInfo: {
          appId: stores.xbox,
          parameters: [{ appExecName: "Game" }],
        },
      });
    }

    // Epic store
    if (store === "epic" && stores.epic) {
      return Promise.resolve({
        launcher: "epic",
        addInfo: {
          appId: stores.epic,
        },
      });
    }

    // For non-steam versions, launch via steam if available
    if (store !== "steam" && stores.steam) {
      return Promise.resolve({
        launcher: "steam",
        addInfo: stores.steam,
      });
    }

    return Promise.resolve(undefined);
  };
}

/**
 * Transforms a GameDefTool from YAML into an ITool.
 *
 * @param tool - Tool definition from YAML
 * @returns ITool object
 */
function transformTool(tool: GameDefTool): ITool {
  return {
    id: tool.id,
    name: tool.name,
    shortName: tool.shortName,
    logo: tool.logo,
    executable: () => tool.executable,
    requiredFiles: tool.requiredFiles ?? [tool.executable],
    relative: tool.relative,
    exclusive: tool.exclusive,
    defaultPrimary: tool.defaultPrimary,
    detach: tool.detach,
    shell: tool.shell,
    parameters: tool.parameters,
    onStart: tool.onStart,
  };
}

/**
 * Transforms a GameDef from YAML into a full IGame object.
 *
 * @param def - The game definition from parsed YAML
 * @param customLogic - Optional custom logic from companion file
 * @param extensionPath - Path to the extension directory for assets
 * @returns A complete IGame object ready for registration
 */
export function transformGameDefToGame(
  def: GameDef,
  customLogic?: IGameCustomLogic,
  extensionPath?: string,
): IGame {
  // Determine the executable function
  const executableFn = Array.isArray(def.executable)
    ? (_discoveredPath?: string) => def.executable[0]
    : (_discoveredPath?: string) => def.executable as string;

  // Determine requiredFiles
  const requiredFiles =
    def.requiredFiles ??
    (Array.isArray(def.executable) ? def.executable : [def.executable]);

  // Build the game object
  const game: IGame = {
    id: def.id,
    name: def.name,
    shortName: def.shortName,
    logo: def.logo,
    executable: executableFn,
    requiredFiles,
    mergeMods: def.mergeMods ?? true,

    // queryModPath - use custom logic if modPath is 'queryModPath', otherwise return static path
    queryModPath:
      def.modPath === "queryModPath"
        ? customLogic?.queryModPath ?? ((_gamePath: string) => ".")
        : (_gamePath: string) => def.modPath,
  };

  // Auto-populate queryArgs from stores
  const queryArgs = buildQueryArgs(def.stores, def.registryPath);
  if (queryArgs) {
    game.queryArgs = queryArgs;
  }

  // Auto-populate gameFinder from stores
  if (def.stores) {
    game.gameFinder = { ...def.stores };
  }

  // Auto-populate details
  const details = buildDetails(def.stores, def.nexusPageId, def.hashFiles);
  if (details) {
    game.details = details;
  }

  // Auto-populate environment
  const environment = buildEnvironment(def.environment, def.stores);
  if (environment) {
    game.environment = environment;
  }

  // Auto-generate requiresLauncher
  const requiresLauncher =
    customLogic?.requiresLauncher ?? buildRequiresLauncher(def.stores);
  if (requiresLauncher) {
    game.requiresLauncher = requiresLauncher;
  }

  // Transform supported tools
  if (def.supportedTools && def.supportedTools.length > 0) {
    game.supportedTools = def.supportedTools.map(transformTool);
  }

  // Set extension path if provided
  if (extensionPath) {
    game.extensionPath = extensionPath;
  }

  // Merge any additional custom logic
  if (customLogic) {
    if (customLogic.setup) {
      game.setup = customLogic.setup;
    }
    if (customLogic.getGameVersion) {
      game.getGameVersion = customLogic.getGameVersion;
    }

    // Merge any other properties from custom logic (excluding already handled ones)
    const handledKeys = [
      "queryModPath",
      "setup",
      "requiresLauncher",
      "getGameVersion",
    ];
    for (const key of Object.keys(customLogic)) {
      if (!handledKeys.includes(key) && customLogic[key] !== undefined) {
        (game as any)[key] = customLogic[key];
      }
    }
  }

  return game;
}
