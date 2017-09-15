import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { IGame } from '../../types/IGame';
import { IState } from '../../types/IState';
import { ITool } from '../../types/ITool';
import {ProcessCanceled} from '../../util/CustomErrors';
import { log } from '../../util/log';

import {
  discoveryFinished,
  discoveryProgress,
  setPhaseCount,
} from './actions/discovery';
import {setKnownGames} from './actions/session';
import { addDiscoveredGame, addDiscoveredTool } from './actions/settings';
import { IDiscoveryResult } from './types/IDiscoveryResult';
import { IGameStored } from './types/IGameStored';
import { IToolStored } from './types/IToolStored';
import { quickDiscovery, searchDiscovery } from './util/discovery';
import Progress from './util/Progress';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as Redux from 'redux';

type EmptyCB = () => void;

/**
 * discovers game modes
 *
 * @class GameModeManager
 */
class GameModeManager {
  private mBasePath: string;
  private mError: boolean;
  private mStore: Redux.Store<IState>;
  private mKnownGames: IGame[];
  private mActiveSearch: Promise<any[]>;
  private mOnGameModeActivated: (mode: string) => void;

  constructor(basePath: string,
              extensionGames: IGame[],
              onGameModeActivated: (mode: string) => void) {
    this.mBasePath = basePath;
    this.mError = false;
    this.mStore = null;
    this.mKnownGames = extensionGames;
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

    const gamesStored: IGameStored[] = this.mKnownGames.map(this.storeGame);
    store.dispatch(setKnownGames(gamesStored));
  }

  /**
   * update the game mode being managed
   *
   * @param {string} newMode
   *
   * @memberOf GameModeManager
   */
  public setGameMode(oldMode: string, newMode: string): Promise<void> {
    const game = this.mKnownGames.find(knownGame => knownGame.id === newMode);
    const gameDiscovery = this.mStore.getState().settings.gameMode.discovered[newMode];
    if (gameDiscovery === undefined) {
      // new game mode is not valid
      return Promise.reject(new Error('game mode not found'));
    }

    return fs.statAsync(gameDiscovery.modPath)
    .then(() => {
      log('info', 'changed game mode', {oldMode, newMode});
      this.mOnGameModeActivated(newMode);
    })
    .catch(err => {
      return (err.code === 'ENOENT')
      ? Promise.reject(new ProcessCanceled('mod directory missing: ' + gameDiscovery.modPath))
      : Promise.reject(err);
    });
  }

  /**
   * prepare change to a different game mode
   *
   * @param {string} gameMode
   * @returns {Promise<void>}
   *
   * @memberOf GameModeManager
   */
  public setupGameMode(gameMode: string): Promise<void> {
    const game = this.mKnownGames.find(knownGame => knownGame.id === gameMode);
    const gameDiscovery = this.mStore.getState().settings.gameMode.discovered[gameMode];

    if ((game === undefined) && (gameDiscovery === undefined)) {
      return Promise.reject(new Error('invalid game mode'));
    } else if ((game === undefined) || (game.setup === undefined)) {
      return Promise.resolve();
    } else {
      return game.setup();
    }
  }

  public get games(): IGame[] {
    return this.mKnownGames;
  }

  /**
   * starts game discovery, only using the search function from the game
   * extension
   *
   * @memberOf GameModeManager
   */
  public startQuickDiscovery() {
    return quickDiscovery(this.mKnownGames, this.onDiscoveredGame, this.onDiscoveredTool);
  }

  /**
   * start game discovery using known files
   *
   * @memberOf GameModeManager
   */
  public startSearchDiscovery(): void {
    const progressCallback = (idx: number, percent: number, label: string) =>
            this.mStore.dispatch(discoveryProgress(idx, percent, label));

    const searchPaths = this.mStore.getState().settings.gameMode.searchPaths;

    this.mStore.dispatch(setPhaseCount(searchPaths.length));

    this.mActiveSearch = searchDiscovery(
      this.mKnownGames,
      this.mStore.getState().settings.gameMode.discovered,
      searchPaths,
      this.onDiscoveredGame,
      this.onDiscoveredTool,
      progressCallback)
    .finally(() => {
      this.mStore.dispatch(discoveryFinished());
    });
  }

  /**
   * stop search discovery
   *
   * @memberOf GameModeManager
   */
  public stopSearchDiscovery(): void {
    log('info', 'stop search', { prom: this.mActiveSearch });
    this.mActiveSearch.cancel();
  }

  private storeGame = (game: IGame): IGameStored => {
    return {
      name: game.name,
      shortName: game.shortName,
      id: game.id,
      logo: game.logo,
      mergeMods: game.mergeMods,
      modPath: game.queryModPath(),
      extensionPath: game.extensionPath,
      requiredFiles: game.requiredFiles,
      supportedTools: game.supportedTools !== null
        ? game.supportedTools.map(this.storeTool)
        : [],
      executable: game.executable(),
      environment: game.environment,
      details: game.details,
    };
  }

  private storeTool(tool: ITool): IToolStored {
    return {
      id: tool.id,
      name: tool.name,
      shortName: tool.shortName,
      logo: tool.logo,
      executable: tool.executable(),
      parameters: tool.parameters || [],
      environment: tool.environment,
    };
  }

  private onDiscoveredTool = (gameId: string, result: IDiscoveredTool) => {
    this.mStore.dispatch(addDiscoveredTool(gameId, result.id, result));
  }

  private onDiscoveredGame = (gameId: string, result: IDiscoveryResult) => {
    if (!path.isAbsolute(result.modPath)) {
      result.modPath = path.resolve(result.path, result.modPath);
    }
    this.mStore.dispatch(addDiscoveredGame(gameId, result));
  }
}

export default GameModeManager;
