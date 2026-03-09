import { setToolRunning, setToolStopped } from "../actions";
import type { IDiscoveredTool } from "../types/IDiscoveredTool";
import type { IGame } from "../types/IGame";
import { log } from "./log";

import GameStoreHelper from "./GameStoreHelper";

import { getSafe } from "./storeHelper";

import type { IDiscoveryResult } from "../extensions/gamemode_management/types/IDiscoveryResult";
import type { IGameStored } from "../extensions/gamemode_management/types/IGameStored";
import type { IToolStored } from "../extensions/gamemode_management/types/IToolStored";
import { getGame } from "../extensions/gamemode_management/util/getGame";

import type { IExtensionApi } from "../types/IExtensionContext";

import { getApplication } from "./application";
import {
  MissingDependency,
  MissingInterpreter,
  ProcessCanceled,
  UserCanceled,
} from "./CustomErrors";
import getVortexPath from "./getVortexPath";

import PromiseBB from "bluebird";
import * as fs from "fs";
import * as path from "path";
import { GameEntryNotFound, GameStoreNotFound } from "../types/IGameStore";
import { getErrorCode, unknownToError } from "@vortex/shared";
import { isWindowsExecutable } from "./linux/proton";
import type { Steam, ISteamEntry } from "./Steam";
import { ApplicationData } from "@vortex/shared";

async function hideWindow(): Promise<void> {
  await window.api.window.hide(ApplicationData.windowId);
}

async function showWindow(): Promise<void> {
  await window.api.window.show(ApplicationData.windowId);
}

async function isWindowVisible(): Promise<boolean> {
  return window.api.window.isVisible(ApplicationData.windowId);
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

  extensionPath: string;
  logoName: string;
}

type OnShowErrorFunc = (
  message: string,
  details?: string | Error | any,
  allowReport?: boolean,
) => void;

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
    const steamStore = GameStoreHelper.getGameStore("steam") as Steam;
    const games = await steamStore.allGames();

    // Find the game entry that matches this executable's location
    return games.find(
      (g) =>
        info.workingDirectory
          ?.toLowerCase()
          .startsWith(g.gamePath.toLowerCase()) ||
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
  public static getGameIcon(
    game: IGameStored,
    gameDiscovery: IDiscoveryResult,
  ): string {
    const extensionPath = gameDiscovery.extensionPath || game.extensionPath;
    const logoName = gameDiscovery.logo || game.logo;
    return StarterInfo.gameIcon(game.id, extensionPath, logoName);
  }

  public static toolIconRW(gameId: string, toolId: string) {
    return path.join(
      getVortexPath("userData"),
      gameId,
      "icons",
      toolId + ".png",
    );
  }

  public static run(
    info: IStarterInfo,
    api: IExtensionApi,
    onShowError: OnShowErrorFunc,
  ) {
    const game: IGame = getGame(info.gameId);
    // Determine if game requires a specific launcher (Steam, Epic, etc.)
    // On Linux, Steam games run through Proton directly rather than via steam -applaunch
    const launcherPromise: PromiseBB<{ launcher: string; addInfo?: any }> =
      game.requiresLauncher !== undefined && info.isGame
        ? PromiseBB.resolve(
            game.requiresLauncher(path.dirname(info.exePath), info.store),
          ).catch((err) => {
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
                    message:
                      "Report this to the community extension author, not Vortex support!",
                  };
              onShowError(
                "Failed to determine if launcher is required",
                errorObj,
                allowReport,
              );
              if (!allowReport) {
                log(
                  "error",
                  "failed to determine if launcher is required",
                  errorObj.message,
                );
              }
            }
            return PromiseBB.resolve(undefined);
          })
        : PromiseBB.resolve(undefined);

    const onSpawned = () => {
      api.store.dispatch(
        setToolRunning(info.exePath, Date.now(), info.exclusive),
      );

      // Flatpak can't reliably observe host game exit for now, so emulate stop after a short delay
      // for now. We'll come up with a better solution/design in the future.
      if (process.platform === "linux" && process.env.IS_FLATPAK === "true") {
        setTimeout(() => {
          api.store.dispatch(setToolStopped(info.exePath));
        }, 2000);
      }
    };

    return launcherPromise.then((res) => {
      if (res !== undefined) {
        const infoObj =
          res.addInfo === undefined
            ? !!game.details
              ? game.details
              : path.dirname(info.exePath)
            : res.addInfo;
        return StarterInfo.runThroughLauncher(res.launcher, info, api, infoObj)
          .then(() => {
            // assuming that runThroughLauncher returns immediately on handing things off
            // to the launcher
            const isLinuxSteamLauncher =
              process.platform !== "win32" && res.launcher === "steam";
            // Keep existing Linux Steam behavior unless running under Flatpak, where we now
            // emulate stop events to avoid stale running state.
            if (!isLinuxSteamLauncher || process.env.IS_FLATPAK === "true") {
              onSpawned();
            }
            if (["hide", "hide_recover"].includes(info.onStart)) {
              void hideWindow();
            } else if (info.onStart === "close") {
              getApplication().quit();
            }
          })
          .catch(UserCanceled, () => null)
          .catch(GameEntryNotFound, (err) => {
            const errorMsg = [
              err.message,
              err.storeName,
              err.existingGames,
            ].join(" - ");
            log("error", errorMsg);
            onShowError(
              "Failed to start game through launcher",
              err,
              !game.contributed,
            );
            return StarterInfo.runDirectly(info, api, onShowError, onSpawned);
          })
          .catch(GameStoreNotFound, (err) => {
            onShowError(
              "Failed to start game through launcher",
              `Game store "${err.storeName}" not supported, is the extension disabled?`,
              false,
            );
            return StarterInfo.runDirectly(info, api, onShowError, onSpawned);
          })
          .catch((err) => {
            onShowError("Failed to start game through launcher", err, true);
            return StarterInfo.runDirectly(info, api, onShowError, onSpawned);
          });
      } else {
        return StarterInfo.runDirectly(info, api, onShowError, onSpawned);
      }
    });
  }

  public static getIconPath(info: IStarterInfo): string {
    if (info["__iconCache"] === undefined) {
      if (info.isGame) {
        info["__iconCache"] = StarterInfo.gameIcon(
          info.gameId,
          info.extensionPath,
          info.logoName,
        );
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

  private static async runDirectly(
    info: IStarterInfo,
    api: IExtensionApi,
    onShowError: OnShowErrorFunc,
    onSpawned: () => void,
  ): Promise<void> {
    const spawned = () => {
      onSpawned();
      if (["hide", "hide_recover"].includes(info.onStart)) {
        void hideWindow();
      } else if (info.onStart === "close") {
        getApplication().quit();
      }
    };

    // Check if game/tool should run through Proton on Linux
    const protonGameEntry = await shouldRunWithProton(info, api);
    if (protonGameEntry?.usesProton) {
      // On Linux with Proton, we can't track when the process exits (ProcessMonitor
      // only works on Windows), so don't set tool as running to avoid stuck spinner
      const protonSpawned = () => {
        if (["hide", "hide_recover"].includes(info.onStart)) {
          hideWindow();
        } else if (info.onStart === "close") {
          getApplication().quit();
        }
      };

      const steamStore = GameStoreHelper.getGameStore("steam") as Steam;
      return steamStore.runToolWithProton(
        api,
        info.exePath,
        info.commandLine,
        {
          cwd: info.workingDirectory || path.dirname(info.exePath),
          env: info.environment,
          suggestDeploy: true,
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
        suggestDeploy: true,
        shell: info.shell,
        detach: info.detach || info.onStart === "close",
        onSpawned: spawned,
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

  private static runThroughLauncher(
    launcher: string,
    info: IStarterInfo,
    api: IExtensionApi,
    addInfo: any,
  ): PromiseBB<void> {
    let gameLauncher;
    try {
      gameLauncher = GameStoreHelper.getGameStore(launcher);
    } catch (err) {
      return PromiseBB.reject(err);
    }
    const infoObj =
      addInfo !== undefined ? addInfo : path.dirname(info.exePath);
    return gameLauncher !== undefined
      ? gameLauncher.launchGame(infoObj, api)
      : PromiseBB.reject(new Error(`unsupported launcher ${launcher}`));
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
    this.detach = getSafe(
      toolDiscovery,
      ["detach"],
      getSafe(tool, ["detach"], true),
    );
    this.onStart = getSafe(
      toolDiscovery,
      ["onStart"],
      getSafe(tool, ["onStart"], undefined),
    );

    if (tool === undefined && toolDiscovery === undefined) {
      this.id = this.gameId;
      this.isGame = true;
      this.initFromGame(game, gameDiscovery);
    } else {
      this.id = getSafe(
        toolDiscovery,
        ["id"],
        getSafe(tool, ["id"], undefined),
      );
      this.isGame = false;
      this.initFromTool(this.gameId, tool, toolDiscovery);
    }
    if (this.id === undefined || this.name === undefined) {
      throw new Error("invalid starter information");
    }
  }

  private initFromGame(game: IGameStored, gameDiscovery: IDiscoveryResult) {
    this.name = gameDiscovery.name || game.name;
    this.exePath = path.join(
      gameDiscovery.path,
      gameDiscovery.executable || game.executable,
    );
    this.commandLine = getSafe(
      gameDiscovery,
      ["parameters"],
      getSafe(game, ["parameters"], []),
    );
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

  private initFromTool(
    gameId: string,
    tool: IToolStored,
    toolDiscovery: IDiscoveredTool,
  ) {
    if (toolDiscovery !== undefined) {
      this.name = getSafe(
        toolDiscovery,
        ["name"],
        getSafe(tool, ["name"], undefined),
      );
      // TODO: umm, the discovery path here stores the path to the exe, whereas for a game it
      //   stores the base path of the game? That's not confusing at all...
      this.exePath = toolDiscovery.path;
      this.commandLine = getSafe(
        toolDiscovery,
        ["parameters"],
        getSafe(tool, ["parameters"], []),
      );
      this.environment =
        getSafe(
          toolDiscovery,
          ["environment"],
          getSafe(tool, ["environment"], {}),
        ) || {};
      this.logoName = getSafe(
        toolDiscovery,
        ["logo"],
        getSafe(tool, ["logo"], undefined),
      );
      this.workingDirectory = getSafe(
        toolDiscovery,
        ["workingDirectory"],
        getSafe(tool, ["workingDirectory"], ""),
      );
      this.shell = getSafe(
        toolDiscovery,
        ["shell"],
        getSafe(tool, ["shell"], undefined),
      );
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
