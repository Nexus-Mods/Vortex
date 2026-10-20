import * as fs from "fs";
import * as path from "path";

import { getErrorCode, getErrorMessageOrDefault, unknownToError } from "@vortex/shared";

import { setToolRunning, setToolStopped } from "../actions";
import { ApplicationData } from "../applicationData";
import { emitModListSnapshot } from "../extensions/analytics/utils/modListSnapshot";
import type { IDiscoveryResult } from "../extensions/gamemode_management/types/IDiscoveryResult";
import type { IGameStored } from "../extensions/gamemode_management/types/IGameStored";
import type { IToolStored } from "../extensions/gamemode_management/types/IToolStored";
import { getGame, getGameStoresSafe } from "../extensions/gamemode_management/util/getGame";
import { log } from "../logging";
import { isExeRunning } from "../reducers/session";
import type { IDiscoveredTool } from "../types/IDiscoveredTool";
import type { IExtensionApi } from "../types/IExtensionContext";
import type { IGame } from "../types/IGame";
import { GameEntryNotFound, GameStoreNotFound } from "../types/IGameStore";
import type { IState } from "../types/IState";
import { getApplication } from "./application";
import {
  MissingDependency,
  MissingInterpreter,
  ProcessCanceled,
  UserCanceled,
} from "./CustomErrors";
import { emitGameLaunched, launchRunsGame, recordLaunchExit } from "./gameLaunchAnalytics";
import getVortexPath from "./getVortexPath";
import { isWindowsExecutable } from "./linux/proton";
import type { Steam, ISteamEntry } from "./Steam";
import { getSafe } from "./storeHelper";
import * as storeLookup from "./storeLookup";

async function hideWindow(): Promise<void> {
  await window.api.window.hide(ApplicationData.instance.windowId);
}

async function showWindow(): Promise<void> {
  await window.api.window.show(ApplicationData.instance.windowId);
}

async function isWindowVisible(): Promise<boolean> {
  return window.api.window.isVisible(ApplicationData.instance.windowId);
}

export interface IStarterInfo {
  id: string;
  gameId: string;
  isGame: boolean;
  iconOutPath: string;
  name: string;
  exePath: string;
  commandLine: string[];
  workingDirectory: string;
  exclusive: boolean;
  detach: boolean;
  shell: boolean;
  store: string;
  onStart?: "hide" | "hide_recover" | "close";
  environment: { [key: string]: string };
  defaultPrimary?: boolean;
  startWithGame?: boolean;

  extensionPath: string;
  logoName: string;
}

type OnShowErrorFunc = (
  message: string,
  details?: string | Error | any,
  allowReport?: boolean,
) => void;

// how long "start with game" tools wait after the game launch has started, so they come up after
// the game rather than racing it
const COMPANION_START_DELAY_MS = 2000;

interface IDirectLaunchOptions {
  // ask to deploy pending changes first. Companion tools skip this, the launch they accompany
  // already asked.
  suggestDeploy: boolean;
  // called once the process has started, on every platform (onSpawned isn't called for Proton)
  onLaunched?: () => void;
}

/**
 * The game's tools flagged to start with it. Leaves out tools that would launch the game
 * themselves (the primary tool, defaultPrimary launchers), so starting a companion never starts
 * more companions, and tools that are hidden, not configured or already running.
 */
function companionStarters(state: IState, info: IStarterInfo): StarterInfo[] {
  const game = (state.session.gameMode.known ?? []).find((known) => known.id === info.gameId);
  const discovery = state.settings.gameMode.discovered?.[info.gameId];
  if (game === undefined || discovery?.path === undefined) {
    return [];
  }

  const knownTools = game.supportedTools ?? [];
  const discoveredTools = discovery.tools ?? {};
  const toolIds = new Set([...knownTools.map((tool) => tool.id), ...Object.keys(discoveredTools)]);
  const toolsRunning = state.session.base?.toolsRunning ?? {};

  const result: StarterInfo[] = [];
  for (const toolId of toolIds) {
    if (toolId === info.id || toolId === info.gameId || discoveredTools[toolId]?.hidden) {
      continue;
    }
    let starter: StarterInfo;
    try {
      starter = new StarterInfo(
        game,
        discovery,
        knownTools.find((tool) => tool.id === toolId),
        discoveredTools[toolId],
      );
    } catch (err) {
      log("warn", "invalid tool", { toolId, error: getErrorMessageOrDefault(err) });
      continue;
    }
    if (
      starter.startWithGame &&
      starter.exePath &&
      !launchRunsGame(starter, state) &&
      !isExeRunning(toolsRunning, starter.exePath)
    ) {
      result.push(starter);
    }
  }
  return result;
}

/**
 * Check if a game or tool should run through Proton on Linux.
 * Returns the matching Steam game entry if Proton should be used, undefined otherwise.
 *
 * This enables running Windows executables directly through Proton rather than
 * via `steam -applaunch`, allowing custom command-line arguments and running
 * different executables (like mod tools) with the game's Proton prefix.
 */
async function shouldRunWithProton(
  info: IStarterInfo,
  api: IExtensionApi,
): Promise<ISteamEntry | undefined> {
  if (process.platform === "win32") {
    return undefined;
  }
  if (!isWindowsExecutable(info.exePath)) {
    return undefined;
  }
  if (info.store !== "steam") {
    return undefined;
  }

  try {
    const steamStore = storeLookup.getGameStore(getGameStoresSafe(), "steam") as Steam;
    const games = await steamStore.allGames();

    // Find the game entry that matches this executable's location
    return games.find(
      (g) =>
        info.workingDirectory?.toLowerCase().startsWith(g.gamePath.toLowerCase()) ||
        info.exePath.toLowerCase().startsWith(g.gamePath.toLowerCase()),
    );
  } catch (err: any) {
    log("debug", "Could not check for Proton execution", {
      error: err?.message,
    });
    return undefined;
  }
}

/**
 * wrapper for information about a game or tool, combining static and runtime/discovery information
 * for the purpose of actually starting them in a uniform way.
 * This implements things like running the game through a launcher (steam/epic/...) if necessary
 *
 * @class StarterInfo
 */
class StarterInfo implements IStarterInfo {
  public static getGameIcon(game: IGameStored, gameDiscovery: IDiscoveryResult): string {
    const extensionPath = gameDiscovery.extensionPath || game.extensionPath;
    const logoName = gameDiscovery.logo || game.logo;
    return StarterInfo.gameIcon(game.id, extensionPath, logoName);
  }

  public static toolIconRW(gameId: string, toolId: string) {
    return path.join(getVortexPath("userData"), gameId, "icons", toolId + ".png");
  }

  public static async run(info: IStarterInfo, api: IExtensionApi, onShowError: OnShowErrorFunc) {
    const game: IGame = getGame(info.gameId);

    // Determine if game requires a specific launcher (Steam, Epic, etc.)
    // On Linux, Steam games run through Proton directly rather than via steam -applaunch
    let launcherResult: { launcher: string; addInfo?: any } | undefined;
    if (game.requiresLauncher !== undefined && info.isGame) {
      try {
        launcherResult = await game.requiresLauncher(path.dirname(info.exePath), info.store);
      } catch (err) {
        if (err instanceof UserCanceled) {
          // warning because it'd be kind of unusual for the user to have to confirm anything
          // in requiresLauncher
          log(
            "warn",
            "failed to determine if launcher is required because user canceled something",
          );
        } else {
          const allowReport = !game.contributed;
          const errorObj = allowReport
            ? err
            : {
                message: "Report this to the community extension author, not Vortex support!",
              };
          onShowError("Failed to determine if launcher is required", errorObj, allowReport);
          if (!allowReport) {
            log("error", "failed to determine if launcher is required", errorObj);
          }
        }
        launcherResult = undefined;
      }
    }

    const onSpawned = StarterInfo.makeOnSpawned(info, api);

    if (launcherResult === undefined) {
      await StarterInfo.runDirectly(info, api, onShowError, onSpawned);
      return;
    }

    const infoObj =
      launcherResult.addInfo === undefined
        ? game.details
          ? game.details
          : path.dirname(info.exePath)
        : launcherResult.addInfo;

    try {
      await StarterInfo.runThroughLauncher(launcherResult.launcher, info, api, infoObj);
      // assuming that runThroughLauncher returns immediately on handing things off
      // to the launcher
      const isLinuxSteamLauncher =
        process.platform !== "win32" && launcherResult.launcher === "steam";
      // Keep existing Linux Steam behavior unless running under Flatpak, where we now
      // emulate stop events to avoid stale running state.
      if (!isLinuxSteamLauncher || process.env.IS_FLATPAK === "true") {
        onSpawned();
      }
      StarterInfo.afterLaunch(info, api, onShowError);
    } catch (err) {
      if (err instanceof UserCanceled) {
        return;
      }

      if (err instanceof GameEntryNotFound) {
        const errorMsg = [err.message, err.storeName, err.existingGames].join(" - ");
        log("error", errorMsg);
        onShowError("Failed to start game through launcher", err, !game.contributed);
        await StarterInfo.runDirectly(info, api, onShowError, onSpawned);
        return;
      }

      if (err instanceof GameStoreNotFound) {
        onShowError(
          "Failed to start game through launcher",
          `Game store "${err.storeName}" not supported, is the extension disabled?`,
          false,
        );
        await StarterInfo.runDirectly(info, api, onShowError, onSpawned);
        return;
      }

      onShowError("Failed to start game through launcher", err, true);
      await StarterInfo.runDirectly(info, api, onShowError, onSpawned);
    }
  }

  public static getIconPath(info: IStarterInfo): string {
    if (info["__iconCache"] === undefined) {
      if (info.isGame) {
        info["__iconCache"] = StarterInfo.gameIcon(info.gameId, info.extensionPath, info.logoName);
      } else {
        info["__iconCache"] = StarterInfo.toolIcon(
          info.gameId,
          info.extensionPath,
          info.id,
          info.logoName,
        );
      }
    }

    return info["__iconCache"];
  }

  private static makeOnSpawned(info: IStarterInfo, api: IExtensionApi): () => void {
    return () => {
      api.store.dispatch(setToolRunning(info.exePath, Date.now(), info.exclusive));
      emitGameLaunched(api, info);
      if (info.isGame) {
        void emitModListSnapshot(api, info.gameId);
      }

      // Flatpak can't reliably observe host game exit for now, so emulate stop after a short delay
      // for now. We'll come up with a better solution/design in the future.
      if (process.platform === "linux" && process.env.IS_FLATPAK === "true") {
        setTimeout(() => {
          api.store.dispatch(setToolStopped(info.exePath));
        }, 2000);
      }
    };
  }

  /**
   * Runs once a launch has started: starts the game's "start with game" tools if this launch runs
   * the game, then applies the launched starter's onStart behavior. Closing Vortex waits until the
   * companion tools have spawned, quitting first would prevent them from starting.
   */
  private static afterLaunch(
    info: IStarterInfo,
    api: IExtensionApi,
    onShowError: OnShowErrorFunc,
  ): void {
    const companions = StarterInfo.startCompanionTools(info, api, onShowError);
    if (["hide", "hide_recover"].includes(info.onStart)) {
      void hideWindow();
    } else if (info.onStart === "close") {
      void companions.then(() => getApplication().quit());
    }
  }

  /**
   * Starts the game's "start with game" tools alongside a launch that runs the game, after a short
   * delay. Resolves once each of them has spawned or failed to.
   */
  private static async startCompanionTools(
    info: IStarterInfo,
    api: IExtensionApi,
    onShowError: OnShowErrorFunc,
  ): Promise<void> {
    const state: IState = api.getState();
    if (!launchRunsGame(info, state)) {
      return;
    }
    const companions = companionStarters(state, info);
    if (companions.length === 0) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, COMPANION_START_DELAY_MS));
    log("info", "starting tools with game", {
      gameId: info.gameId,
      tools: companions.map((tool) => tool.id),
    });
    // a companion must outlive Vortex if the launch is about to close it
    const keepAfterQuit = info.onStart === "close";
    await Promise.all(
      companions.map((tool) => StarterInfo.startCompanion(tool, api, onShowError, keepAfterQuit)),
    );
  }

  private static startCompanion(
    tool: IStarterInfo,
    api: IExtensionApi,
    onShowError: OnShowErrorFunc,
    keepAfterQuit: boolean,
  ): Promise<void> {
    // hiding or closing Vortex is up to the launch the companion accompanies, not the companion
    const companion: IStarterInfo = {
      ...tool,
      onStart: undefined,
      detach: tool.detach || keepAfterQuit,
    };
    return new Promise<void>((resolve) => {
      StarterInfo.runDirectly(
        companion,
        api,
        onShowError,
        StarterInfo.makeOnSpawned(companion, api),
        {
          suggestDeploy: false,
          onLaunched: resolve,
        },
      )
        .catch((err) => onShowError("Failed to start tool with game", err))
        .finally(resolve);
    });
  }

  private static async runDirectly(
    info: IStarterInfo,
    api: IExtensionApi,
    onShowError: OnShowErrorFunc,
    onSpawned: () => void,
    launch: IDirectLaunchOptions = { suggestDeploy: true },
  ): Promise<void> {
    const spawned = () => {
      onSpawned();
      launch.onLaunched?.();
      StarterInfo.afterLaunch(info, api, onShowError);
    };

    // Check if game/tool should run through Proton on Linux
    const protonGameEntry = await shouldRunWithProton(info, api);
    if (protonGameEntry?.usesProton) {
      // On Linux with Proton, we can't track when the process exits (ProcessMonitor
      // only works on Windows), so don't set tool as running to avoid stuck spinner
      const protonSpawned = () => {
        launch.onLaunched?.();
        void StarterInfo.startCompanionTools(info, api, onShowError);
        if (["hide", "hide_recover"].includes(info.onStart)) {
          hideWindow();
        } else if (info.onStart === "close") {
          getApplication().quit();
        }
      };

      const steamStore = storeLookup.getGameStore(getGameStoresSafe(), "steam") as Steam;
      return steamStore.runToolWithProton(
        api,
        info.exePath,
        info.commandLine,
        {
          cwd: info.workingDirectory || path.dirname(info.exePath),
          env: info.environment,
          suggestDeploy: launch.suggestDeploy,
          shell: info.shell,
          detach: info.detach || info.onStart === "close",
          onSpawned: protonSpawned,
        },
        protonGameEntry,
      );
    }

    return api
      .runExecutable(info.exePath, info.commandLine, {
        cwd: info.workingDirectory || path.dirname(info.exePath),
        env: info.environment,
        suggestDeploy: launch.suggestDeploy,
        shell: info.shell,
        detach: info.detach || info.onStart === "close",
        onSpawned: spawned,
        onExit: (code) => recordLaunchExit(info.exePath, code),
      })
      .catch(ProcessCanceled, () => undefined)
      .catch(UserCanceled, () => undefined)
      .catch(MissingDependency, () => {
        onShowError(
          "Failed to run tool",
          {
            executable: info.exePath,
            message:
              "An Application/Tool dependency is missing, please consult the " +
              "Application/Tool documentation for required dependencies.",
          },
          false,
        );
      })
      .catch((unknownError) => {
        const code = getErrorCode(unknownError);
        const err = unknownToError(unknownError);
        if (code === "ENOENT") {
          onShowError(
            "Failed to run tool",
            {
              Executable: info.exePath,
              message:
                "Executable doesn't exist, please check the configuration for the " +
                "tool you tried to start.",
              stack: err.stack,
            },
            false,
          );
        } else if (code === "EBUSY") {
          // Application is still running in the background. Let the user know and suppress
          //  the report button.
          onShowError(
            "Failed to run tool",
            {
              Executable: info.exePath,
              message:
                "The executable is running in the background or is being locked by an " +
                "external application. Please close any running instances of the tool/game " +
                "and/or external applications which may be locking the executable and retry.",
              stack: err.stack,
            },
            false,
          );
        } else if (["UNKNOWN", "EFTYPE"].includes(code)) {
          // info sucks but node.js doesn't give us too much information about what went wrong
          // and we can't have users misconfigure their tools and then report the error they
          // get as feedback
          onShowError(
            "Failed to run tool",
            {
              Executable: info.exePath,
              message:
                "File is not executable, please check the configuration for the " +
                "tool you tried to start.",
              stack: err.stack,
            },
            false,
          );
        } else if (err instanceof MissingInterpreter) {
          const par = {
            Error: err.message,
          };
          if (err.url !== undefined) {
            par["Download url"] = err.url;
          }
          onShowError("Failed to run tool", par, false);
        } else {
          onShowError("Failed to run tool", {
            executable: info.exePath,
            error: err,
          });
        }
      })
      .then(async () => {
        if (info.onStart === "hide_recover" && !(await isWindowVisible())) {
          await showWindow();
        }
      });
  }

  private static async runThroughLauncher(
    launcher: string,
    info: IStarterInfo,
    api: IExtensionApi,
    addInfo: any,
  ): Promise<void> {
    const gameLauncher = storeLookup.getGameStore(getGameStoresSafe(), launcher);
    if (gameLauncher === undefined) {
      throw new Error(`unsupported launcher ${launcher}`);
    }
    const infoObj = addInfo !== undefined ? addInfo : path.dirname(info.exePath);
    return gameLauncher.launchGame(infoObj, api);
  }

  private static gameIcon(gameId: string, extensionPath: string, logo: string) {
    try {
      const iconPath = this.gameIconRW(gameId);
      fs.statSync(iconPath);
      return iconPath;
    } catch (err) {
      if (logo !== undefined) {
        return path.join(extensionPath, logo);
      } else {
        return undefined;
      }
    }
  }

  private static gameIconRW(gameId: string) {
    return path.join(getVortexPath("userData"), gameId, "icon.png");
  }

  private static toolIcon(
    gameId: string,
    extensionPath: string,
    toolId: string,
    toolLogo: string,
  ): string {
    try {
      const iconPath = this.toolIconRW(gameId, toolId);
      fs.statSync(iconPath);
      return iconPath;
    } catch (err) {
      if (toolLogo === undefined) {
        return undefined;
      }
      try {
        const iconPath = path.join(extensionPath, toolLogo);
        fs.statSync(iconPath);
        return iconPath;
      } catch (err) {
        return undefined;
      }
    }
  }
  public id: string;
  public gameId: string;
  public isGame: boolean;
  public iconOutPath: string;
  public name: string;
  public exePath: string;
  public commandLine: string[];
  public workingDirectory: string;
  public environment: { [key: string]: string };
  public originalEnvironment: { [key: string]: string };
  public shell: boolean;
  public details: { [key: string]: any } = {};
  public exclusive: boolean;
  public detach: boolean;
  public onStart?: "hide" | "hide_recover" | "close";
  public defaultPrimary: boolean;
  public startWithGame: boolean;
  public extensionPath: string;
  public logoName: string;
  public timestamp: number;
  public store: string;

  constructor(
    game: IGameStored,
    gameDiscovery: IDiscoveryResult,
    tool?: IToolStored,
    toolDiscovery?: IDiscoveredTool,
  ) {
    this.gameId = gameDiscovery.id || game.id;
    this.extensionPath = gameDiscovery.extensionPath || game.extensionPath;
    // Store is set from game discovery for both games and tools
    // Tools need this to enable Proton execution on Linux
    this.store = gameDiscovery.store;
    this.detach = getSafe(toolDiscovery, ["detach"], getSafe(tool, ["detach"], true));
    this.onStart = getSafe(toolDiscovery, ["onStart"], getSafe(tool, ["onStart"], undefined));
    this.startWithGame = getSafe(
      toolDiscovery,
      ["startWithGame"],
      getSafe(tool, ["startWithGame"], false),
    );

    if (tool === undefined && toolDiscovery === undefined) {
      this.id = this.gameId;
      this.isGame = true;
      this.initFromGame(game, gameDiscovery);
    } else {
      this.id = getSafe(toolDiscovery, ["id"], getSafe(tool, ["id"], undefined));
      this.isGame = false;
      this.initFromTool(this.gameId, tool, toolDiscovery);
    }
    if (this.id === undefined || this.name === undefined) {
      throw new Error("invalid starter information");
    }
  }

  private initFromGame(game: IGameStored, gameDiscovery: IDiscoveryResult) {
    this.name = gameDiscovery.name || game.name;
    this.exePath = path.join(gameDiscovery.path, gameDiscovery.executable || game.executable);
    this.commandLine = getSafe(gameDiscovery, ["parameters"], getSafe(game, ["parameters"], []));
    this.workingDirectory = path.dirname(this.exePath);
    this.originalEnvironment = getSafe(game, ["environment"], {});
    this.environment = getSafe(gameDiscovery, ["envCustomized"], false)
      ? getSafe(gameDiscovery, ["environment"], {})
      : this.originalEnvironment;
    this.iconOutPath = StarterInfo.gameIconRW(this.gameId);
    this.shell = gameDiscovery.shell || game.shell;
    this.logoName = gameDiscovery.logo || game.logo;
    this.details = game.details;
    this.exclusive = true;
  }

  private initFromTool(gameId: string, tool: IToolStored, toolDiscovery: IDiscoveredTool) {
    if (toolDiscovery !== undefined) {
      this.name = getSafe(toolDiscovery, ["name"], getSafe(tool, ["name"], undefined));
      // TODO: umm, the discovery path here stores the path to the exe, whereas for a game it
      //   stores the base path of the game? That's not confusing at all...
      this.exePath = toolDiscovery.path;
      this.commandLine = getSafe(toolDiscovery, ["parameters"], getSafe(tool, ["parameters"], []));
      this.environment =
        getSafe(toolDiscovery, ["environment"], getSafe(tool, ["environment"], {})) || {};
      this.logoName = getSafe(toolDiscovery, ["logo"], getSafe(tool, ["logo"], undefined));
      this.workingDirectory = getSafe(
        toolDiscovery,
        ["workingDirectory"],
        getSafe(tool, ["workingDirectory"], ""),
      );
      this.shell = getSafe(toolDiscovery, ["shell"], getSafe(tool, ["shell"], undefined));
      this.exclusive = getSafe(tool, ["exclusive"], false) || false;
      this.defaultPrimary = getSafe(tool, ["defaultPrimary"], false);
      this.timestamp = toolDiscovery.timestamp;
    } else {
      // defaults for undiscovered & unconfigured tools
      this.name = tool.name;
      this.exePath = "";
      this.commandLine = tool.parameters;
      this.workingDirectory = "";
      this.environment = tool.environment || {};
      this.logoName = tool.logo;
      this.shell = tool.shell;
    }
    this.iconOutPath = StarterInfo.toolIconRW(gameId, this.id);
  }
}

export default StarterInfo;
