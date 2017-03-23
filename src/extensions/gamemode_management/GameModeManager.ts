import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { IGame } from '../../types/IGame';
import { IState } from '../../types/IState';
import { ITool } from '../../types/ITool';
import { log } from '../../util/log';

import { discoveryFinished, discoveryProgress } from './actions/discovery';
import { setKnownGames } from './actions/session';
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

  constructor(basePath: string, onGameModeActivated: (mode: string) => void) {
    this.mBasePath = basePath;
    this.mError = false;
    this.mStore = null;
    this.mKnownGames = [];
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
    let gamesPath: string = path.resolve(__dirname, '..', '..', 'games');
    let games: IGame[] = this.loadDynamicGames(gamesPath);
    gamesPath = path.join(remote.app.getPath('userData'), 'games');
    this.mKnownGames = games.concat(this.loadDynamicGames(gamesPath));

    this.mStore = store;

    // TODO handle the case where there are games previously discovered that
    //      are now no longer known
    // TODO verify that previously discovered games are still available in
    //      their existing location
    let gamesStored: IGameStored[] = this.mKnownGames.map(this.storeGame);
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
    if (this.mStore.getState().session.gameMode.known.findIndex((knownGame: IGameStored) => {
      return knownGame.id === newMode;
    }) === -1) {
      // new game mode is not valid
      return Promise.reject(new Error('unknown game mode'));
    }

    log('info', 'changed game mode', {oldMode, newMode, process: process.type});
    this.mOnGameModeActivated(newMode);
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
    let game: IGame = this.mKnownGames.find((ele: IGame) => ele.id === gameMode);
    if (game === undefined) {
      return Promise.reject(new Error('invalid game mode'));
    } else if (game.setup === undefined) {
      return Promise.resolve();
    } else {
      return game.setup();
    }
  }

  /**
   * starts game discovery, only using the search function from the game
   * extension
   * 
   * @memberOf GameModeManager
   */
  public startQuickDiscovery() {
    quickDiscovery(this.mKnownGames, this.onDiscoveredGame, this.onDiscoveredTool);
  }

  /**
   * start game discovery using known files
   * 
   * @memberOf GameModeManager
   */
  public startSearchDiscovery(): void {
    let progress: Progress = new Progress(0, 100, (percent: number, label: string) => {
      this.mStore.dispatch(discoveryProgress(percent, label));
    });

    this.mActiveSearch = searchDiscovery(
      this.mKnownGames,
      this.mStore.getState().settings.gameMode.discovered,
      this.mStore.getState().settings.gameMode.searchPaths,
      this.onDiscoveredGame,
      this.onDiscoveredTool,
      progress)
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
      extensionPath: game.pluginPath,
      iniFilePath: game.iniFilePath(),
      requiredFiles: game.requiredFiles,
      supportedTools: game.supportedTools !== null
        ? game.supportedTools.map(this.storeTool)
        : [],
      executable: game.executable(),
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

  private loadDynamicGame(extensionPath: string): IGame {
    log('info', 'loading game support from', extensionPath);
    let indexPath = path.join(extensionPath, 'index.js');
    if (fs.existsSync(indexPath)) {
      let res: IGame = require(indexPath).default;
      res.pluginPath = extensionPath;
      return res;
    } else {
      return undefined;
    }
  }

  private loadDynamicGames(extensionsPath: string): IGame[] {
    log('info', 'looking for game support plugins', extensionsPath);

    if (!fs.existsSync(extensionsPath)) {
      log('warn', 'failed to load game extensions, path doesn\'t exist', extensionsPath);
      fs.mkdirSync(extensionsPath);
      return [];
    }

    const res = fs.readdirSync(extensionsPath)
      .filter((name) => fs.statSync(path.join(extensionsPath, name)).isDirectory())
      .map((name) => {
        try {
          return this.loadDynamicGame(path.join(extensionsPath, name));
        } catch (err) {
          log('warn', 'failed to load game extension', { error: err.message });
          return undefined;
        }
      });

    return res.filter((item) => item !== undefined);
  }
}

export default GameModeManager;
