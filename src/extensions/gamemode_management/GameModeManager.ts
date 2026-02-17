import { setNextProfile } from "../../renderer/actions";
import {
  addNotification,
  showDialog,
} from "../../renderer/actions/notifications";
import type { IDiscoveredTool } from "../../renderer/types/IDiscoveredTool";
import type {
  IExtensionApi,
  ThunkStore,
} from "../../renderer/types/IExtensionContext";
import type { IGame } from "../../renderer/types/IGame";
import type {
  GameEntryNotFound,
  IGameStore,
} from "../../renderer/types/IGameStore";
import type { IState } from "../../renderer/types/IState";
import type { ITool } from "../../renderer/types/ITool";
import { getNormalizeFunc } from "../../util/api";
import {
  ProcessCanceled,
  SetupError,
  UserCanceled,
} from "../../util/CustomErrors";
import EpicGamesLauncher from "../../util/EpicGamesLauncher";
import * as fs from "../../util/fs";
import GameStoreHelper from "../../util/GameStoreHelper";
import { log } from "../../util/log";
import { activeProfile, discoveryByGame } from "../../util/selectors";
import Steam from "../../util/Steam";
import { getSafe } from "../../util/storeHelper";
import { batchDispatch, truthy } from "../../util/util";

import type { IExtensionDownloadInfo } from "../../renderer/types/extensions";
import { setPrimaryTool } from "../starter_dashlet/actions";

import {
  discoveryFinished,
  discoveryProgress,
  setPhaseCount,
} from "./actions/discovery";
import {
  clearGameDisabled,
  setGameDisabled,
  setKnownGames,
} from "./actions/session";
import {
  addDiscoveredGame,
  addDiscoveredTool,
  clearDiscoveredGame,
} from "./actions/settings";
import type { IDiscoveryResult } from "./types/IDiscoveryResult";
import type { IGameStored } from "./types/IGameStored";
import type { IToolStored } from "./types/IToolStored";
import {
  assertToolDir,
  discoverRelativeTools,
  quickDiscovery,
  quickDiscoveryTools,
  searchDiscovery,
} from "./util/discovery";
import { getGame } from "./util/getGame";

import PromiseBB from "bluebird";
import * as _ from "lodash";
import * as path from "path";
import type * as Redux from "redux";

export interface IGameStub {
  ext: IExtensionDownloadInfo;
  game: IGame;
}

/**
 * discovers game modes
 *
 * @class GameModeManager
 */
class GameModeManager {
  private mApi: IExtensionApi;
  private mStore: ThunkStore<IState>;
  private mKnownGames: IGame[];
  private mGameStubs: IGameStub[];
  private mKnownGameStores: IGameStore[];
  private mActiveSearch: PromiseBB<void>;
  private mOnGameModeActivated: (mode: string) => void;

  constructor(
    api: IExtensionApi,
    extensionGames: IGame[],
    gameStubs: IGameStub[],
    gameStoreExtensions: IGameStore[],
    onGameModeActivated: (mode: string) => void,
  ) {
    this.mApi = api;
    this.mStore = null;
    this.mKnownGames = extensionGames;
    this.mGameStubs = gameStubs;
    this.mKnownGameStores = [Steam, EpicGamesLauncher, ...gameStoreExtensions];
    this.mActiveSearch = null;
    this.mOnGameModeActivated = onGameModeActivated;
  }

  /**
   * attach this manager to the specified store
   *
   * @param {Redux.Store<IStateEx>} store
   *
   * @memberOf GameModeManager
   */
  public attachToStore(store: Redux.Store<IState>) {
    this.mStore = store;

    const gamesStored: IGameStored[] = this.mKnownGames
      .map(this.storeGame)
      .filter(this.isValidGame);
    store.dispatch(setKnownGames(gamesStored));
    // we used to activate the game mode right here but there is another
    // call to do this in the "once" CB of gamemode_management so it's
    // redundant and the other call handles errors properly while this one
    // didn't
  }

  /**
   * update the game mode being managed
   *
   * @param {string} newMode
   *
   * @memberOf GameModeManager
   */
  public setGameMode(
    oldMode: string,
    newMode: string,
    profileId: string,
  ): PromiseBB<void> {
    log("debug", "set game mode", { oldMode, newMode });
    const game = this.mKnownGames.find((knownGame) => knownGame.id === newMode);
    const discoveredGames = this.mStore.getState().settings.gameMode.discovered;
    const gameDiscovery = discoveredGames[newMode];
    if (game === undefined || gameDiscovery?.path === undefined) {
      // new game mode is not valid
      return PromiseBB.reject(new ProcessCanceled("game mode not found"));
    }

    let modPath;
    try {
      modPath = game.queryModPath(gameDiscovery.path);
      if (!path.isAbsolute(modPath)) {
        modPath = path.resolve(gameDiscovery.path, modPath);
      }
    } catch (err) {
      return PromiseBB.reject(err);
    }
    // the game is listed and available to be activated if it was found in any store
    // but in that case we haven't verified yet whether the directory actually contains the game
    // (with the expected files)
    return assertToolDir(game, gameDiscovery.path)
      .then(() => fs.statAsync(modPath))
      .then(() => this.ensureWritable(modPath))
      .then(() => getNormalizeFunc(gameDiscovery.path))
      .then((normalize) =>
        discoverRelativeTools(
          game,
          gameDiscovery.path,
          discoveredGames,
          this.onDiscoveredTool,
          normalize,
        ),
      )
      .then(() => {
        const state = this.mStore.getState();
        const currentProfile = activeProfile(state);
        if (currentProfile !== undefined && profileId === currentProfile.id) {
          log("info", "changed game mode", { oldMode, newMode });
          this.mOnGameModeActivated(newMode);
          const { gameId } = currentProfile;
          if (
            getSafe(
              state,
              ["settings", "interface", "primaryTool", gameId],
              undefined,
            ) === undefined
          ) {
            const discovery = discoveryByGame(state, gameId);
            if (truthy(discovery.tools)) {
              const defaultPrimary = Object.keys(discovery.tools).find(
                (toolId) => discovery.tools[toolId].defaultPrimary === true,
              );
              if (defaultPrimary !== undefined) {
                this.mStore.dispatch(setPrimaryTool(gameId, defaultPrimary));
              }
            }
          }
        } else {
          log("info", "game prepared but it's no longer active");
        }
      })
      .catch((err) => {
        return ["ENOENT", "ENOTFOUND"].includes(err.code)
          ? PromiseBB.reject(
              new SetupError("Missing: " + (err.filename || modPath)),
            )
          : PromiseBB.reject(err);
      });
  }

  /**
   * prepare change to a different game mode
   *
   * @param {string} gameMode
   * @returns {PromiseBB<void>}
   *
   * @memberOf GameModeManager
   */
  public setupGameMode(gameMode: string): PromiseBB<void> {
    const game = getGame(gameMode);
    const gameDiscovery =
      this.mStore.getState().settings.gameMode.discovered[gameMode];

    log("debug", "setup game mode", gameMode);
    if (gameDiscovery?.path === undefined) {
      // if the user starts Vortex with --game xyz and that game was previously detected
      // but has been uninstalled since then, Vortex initiates the profile/game switch
      // assuming it knows where the game is. By the time we get here, discovery may
      // have completed and reset the game discovery.
      // It would be nicer if all game switching could be deferred until after discovery
      // has run but that would be a major change that would require a proper round of
      // testing which is not going to happen now so we have to accept this as a valid
      // situation.
      return PromiseBB.reject(new ProcessCanceled("game not discovered"));
    } else if (game?.setup === undefined) {
      return game
        .getInstalledVersion(gameDiscovery)
        .then(() => PromiseBB.resolve());
    } else {
      try {
        return (
          assertToolDir(game, gameDiscovery.path)
            .then(() => fs.statAsync(gameDiscovery.path))
            // We check the game's version before calling the setup function to avoid
            //  locking game files if the gameversion hash extension is used.
            .then(() => game.getInstalledVersion(gameDiscovery))
            .then(() =>
              PromiseBB.resolve(game.setup(gameDiscovery)).catch((err) => {
                // don't allow reporting if the game extension setup function fails
                if (game.contributed) {
                  err["allowReport"] = false;
                }
                return PromiseBB.reject(err);
              }),
            )
            .catch((err) =>
              err.code === "ENOENT" && err.path === gameDiscovery.path
                ? PromiseBB.reject(
                    new ProcessCanceled(
                      `Game folder "${gameDiscovery.path}" doesn't exist (any more).`,
                    ),
                  )
                : PromiseBB.reject(err),
            )
        );
      } catch (err) {
        return PromiseBB.reject(err);
      }
    }
  }

  public get games(): IGame[] {
    return this.mKnownGames;
  }

  public get stubs(): IGameStub[] {
    return this.mGameStubs;
  }

  public get gameStores(): IGameStore[] {
    return this.mKnownGameStores;
  }

  /**
   * starts game discovery, only using the search function from the game
   * extension
   *
   * @memberOf GameModeManager
   */
  public startQuickDiscovery(games?: IGame[]) {
    return this.reloadStoreGames()
      .then(() =>
        quickDiscovery(
          games ?? this.mKnownGames,
          this.mStore.getState().settings.gameMode.discovered,
          this.onDiscoveredGame,
          this.onDiscoveredTool,
        ),
      )
      .then((result) => {
        this.postDiscovery();
        return result;
      });
  }

  public startToolDiscovery(gameId: string) {
    const game = this.mKnownGames.find((iter) => iter.id === gameId);
    if (game !== undefined) {
      const discoveredGames =
        this.mStore.getState().settings.gameMode.discovered;
      const discovery =
        this.mStore.getState().settings.gameMode.discovered[game.id];
      return quickDiscoveryTools(
        gameId,
        game.supportedTools,
        this.onDiscoveredTool,
      )
        .then(() => getNormalizeFunc(discovery.path))
        .then((normalize) =>
          discoverRelativeTools(
            game,
            discovery.path,
            discoveredGames,
            this.onDiscoveredTool,
            normalize,
          ),
        );
    } else {
      return PromiseBB.reject(new Error("unknown game id: " + gameId));
    }
  }

  public isSearching(): boolean {
    return this.mActiveSearch !== null;
  }

  /**
   * start game discovery using known files
   *
   * @memberOf GameModeManager
   */
  public startSearchDiscovery(searchPaths: string[]): void {
    const progressCallback = (idx: number, percent: number, label: string) =>
      this.mStore.dispatch(discoveryProgress(idx, percent || 0, label));

    const state: IState = this.mStore.getState();

    if (!Array.isArray(searchPaths)) {
      throw new Error(
        "invalid search paths: " + require("util").inspect(searchPaths),
      );
    }

    if (state.session.discovery.running) {
      // already scanning
      return;
    }

    this.mStore.dispatch(setPhaseCount(searchPaths.length));

    let numDiscovered = 0;
    const onDiscoveredGame = (gameId: string, result: IDiscoveryResult) => {
      ++numDiscovered;
      this.onDiscoveredGame(gameId, result);
    };

    const { discovered } = state.settings.gameMode;

    this.mActiveSearch = searchDiscovery(
      this.mKnownGames,
      discovered,
      searchPaths.slice().sort(),
      onDiscoveredGame,
      this.onDiscoveredTool,
      this.onError,
      progressCallback,
    )
      .then((directoriesRead: number) => {
        this.mStore.dispatch(
          addNotification({
            type: "success",
            title: "Search finished",
            message:
              "{{searched}} directories were searched, {{numTotal}} games found ({{numDiscovered}} new)",
            replace: {
              searched: directoriesRead,
              numDiscovered,
              numTotal: Object.values(discovered).filter(
                (iter) => iter.path !== undefined,
              ).length,
            },
            displayMS: 10000,
          }),
        );
      })
      .finally(() => {
        this.mStore.dispatch(discoveryFinished());
        this.mActiveSearch = null;
        return this.postDiscovery();
      });
  }

  /**
   * stop search discovery
   *
   * @memberOf GameModeManager
   */
  public stopSearchDiscovery(): void {
    log("info", "stop search");
    if (this.mActiveSearch !== null) {
      this.mActiveSearch.cancel();
      this.mActiveSearch = null;
    }
  }

  private postDiscovery() {
    const { discovered } = this.mStore.getState().settings.gameMode;
    this.mStore.dispatch(clearGameDisabled());
    PromiseBB.map(Object.keys(discovered), (gameId) => {
      if (discovered[gameId].path === undefined) {
        return PromiseBB.resolve();
      }

      return getNormalizeFunc(discovered[gameId].path)
        .then((normalize) => {
          const discovery = discovered[gameId];
          const game = getGame(gameId);
          // game may be uninstalled here so game being undefined is fine
          if (game?.overrides !== undefined) {
            game.overrides.forEach((override) => {
              if (
                discovered[override]?.path !== undefined &&
                normalize(discovered[override].path) ===
                  normalize(discovery.path)
              ) {
                this.mStore.dispatch(setGameDisabled(override, gameId));
              }
            });
          }
        })
        .catch((err) => {
          // error is probably that normalization failed. Considering how rarely this
          // mechanism will be used, showing a notification feels like overkill
          log("error", "failed to check if game should be overridden", {
            gameId,
            error: err.message,
          });
          return PromiseBB.resolve();
        });
    });
  }

  private ensureWritable(modPath: string): PromiseBB<void> {
    return fs.ensureDirWritableAsync(
      modPath,
      () =>
        new PromiseBB<void>((resolve, reject) => {
          this.mStore.dispatch(
            showDialog(
              "question",
              "Access Denied",
              {
                text:
                  "The mod directory for this game is not writable to your user account.\n" +
                  "If you have admin rights on this system, Vortex can change the permissions " +
                  "to allow it write access.",
              },
              [
                { label: "Cancel", action: () => reject(new UserCanceled()) },
                { label: "Allow access", action: () => resolve() },
              ],
            ),
          );
        }),
    );
  }

  private reloadStoreGames() {
    return GameStoreHelper.reloadGames(this.mApi);
  }

  private isValidGame(game: IGameStored): boolean {
    return (
      game.executable !== undefined &&
      game.requiredFiles !== undefined &&
      game.name !== undefined
    );
  }

  private storeGame = (game: IGame): IGameStored => {
    return {
      name: game.name,
      shortName: game.shortName,
      id: game.id,
      logo: game.logo,
      extensionPath: game.extensionPath,
      parameters: game.parameters || [],
      requiredFiles: game.requiredFiles,
      supportedTools:
        game.supportedTools !== undefined
          ? game.supportedTools.map(this.storeTool)
          : [],
      executable: game.executable(),
      environment: game.environment,
      details: game.details,
      shell: game.shell,
      contributed: game.contributed,
      final: game.final,
    };
  };

  private storeTool(tool: ITool): IToolStored {
    const SKIPPED_TOOL_ATTRIBUTES = [
      "id",
      "name",
      "logo",
      "executable",
      "queryPath",
      "parameters",
      "requiredFiles",
      "relative",
    ];

    return {
      ..._.omit(tool, SKIPPED_TOOL_ATTRIBUTES),
      id: tool.id || "MISSING_ID",
      name: tool.name || "MISSING_NAME",
      logo: tool.logo || "MISSING_LOGO",
      parameters: tool.parameters || [],
      environment: tool.environment || {},
      executable: tool.executable(),
    };
  }

  private onDiscoveredTool = (gameId: string, result: IDiscoveredTool) => {
    const existing = getSafe(
      this.mStore.getState(),
      ["settings", "gameMode", "discovered", gameId, "tools", result.id],
      undefined,
    );
    // don't overwrite customised tools
    if (existing === undefined || !existing.custom) {
      delete result.executable;
      this.mStore.dispatch(addDiscoveredTool(gameId, result.id, result, false));
    }
  };

  private onDiscoveredGame = (gameId: string, result: IDiscoveryResult) => {
    if (result === undefined) {
      const currentProfile = activeProfile(this.mStore.getState());
      const batchedActions =
        currentProfile?.gameId === gameId
          ? [setNextProfile(undefined), clearDiscoveredGame(gameId)]
          : [clearDiscoveredGame(gameId)];
      batchDispatch(this.mStore, batchedActions);
    } else {
      this.mStore.dispatch(addDiscoveredGame(gameId, result));
    }
  };

  private onError = (title: string, message: string) => {
    this.mStore.dispatch(
      addNotification({
        type: "error",
        message,
        title,
      }),
    );
  };
}

export default GameModeManager;
