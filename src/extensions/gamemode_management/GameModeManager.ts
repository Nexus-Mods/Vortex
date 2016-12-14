import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { IGame } from '../../types/IGame';
import { ITool } from '../../types/ITool';
import { terminate } from '../../util/errorHandling';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import StorageLogger from '../../util/StorageLogger';

import { discoveryFinished, discoveryProgress } from './actions/discovery';
import { setKnownGames } from './actions/session';
import { addDiscoveredGame, addDiscoveredTool, setGameMode } from './actions/settings';
import { IDiscoveryResult, IGameStored, IStateEx, IToolStored } from './types/IStateEx';
import { quickDiscovery, searchDiscovery } from './util/discovery';
import Progress from './util/Progress';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { Persistor, createPersistor, getStoredState } from 'redux-persist';
import { AsyncNodeStorage } from 'redux-persist-node-storage';

const getStoredStateP = Promise.promisify(getStoredState);

type EmptyCB = () => void;

/**
 * discovers game modes
 * 
 * @class GameModeManager
 */
class GameModeManager {

  private mBasePath: string;
  private mPersistor: Persistor;
  private mError: boolean;
  private mStore: Redux.Store<IStateEx>;
  private mKnownGames: IGame[];
  private mActiveSearch: Promise<any[]>;
  private mOnGameModeActivated: (mode: string) => void;
  private mStateWhitelist: string[];

  constructor(basePath: string, onGameModeActivated: (mode: string) => void, whitelist: string[]) {
    this.mBasePath = basePath;
    this.mPersistor = null;
    this.mError = false;
    this.mStore = null;
    this.mKnownGames = [];
    this.mActiveSearch = null;
    this.mOnGameModeActivated = onGameModeActivated;
    this.mStateWhitelist = whitelist;
  }

  /**
   * attach this manager to the specified store
   * 
   * @param {Redux.Store<IStateEx>} store
   * 
   * @memberOf GameModeManager
   */
  public attachToStore(store: Redux.Store<IStateEx>) {
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
  public setGameMode(oldMode: string, newMode: string) {
    log('info', 'changed game mode', {oldMode, newMode, process: process.type});
    // stop old persistor before proceeding
    new Promise((resolve, reject) => {
      if (this.mPersistor !== null) {
        this.mPersistor.stop(resolve);
      } else {
        resolve();
      }
    })
        .then(() => { return this.activateGameMode(newMode, this.mStore); })
        .then((persistor) => {
          this.mPersistor = persistor;
          this.mOnGameModeActivated(newMode);
          this.mError = false;
        })
        .catch((err) => {
          if (!this.mError) {
            // first error, try reverting to the previous game mode
            this.mError = true;
            showError(this.mStore.dispatch, 'Failed to change game mode', err);
            this.mStore.dispatch(setGameMode(oldMode));
          } else {
            terminate({message: 'Failed to change game mode', details: err});
          }
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
      id: game.id,
      logo: game.logo,
      modPath: game.queryModPath(),
      pluginPath: game.pluginPath,
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
      logo: tool.logo,
      executable: tool.executable(),
      parameters: tool.parameters || [],
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

  private activateGameMode(mode: string, store: Redux.Store<IStateEx>): Promise<Persistor> {
    if (mode === undefined) {
      return Promise.resolve(null);
    }

    const statePath: string = path.join(this.mBasePath, mode, 'state');

    let settings = undefined;
    return fs.ensureDirAsync(statePath)
      .then(() => {
        // step 2: retrieve stored state
        settings = {
          storage: new StorageLogger(new AsyncNodeStorage(statePath)),
          whitelist: this.mStateWhitelist,
          keyPrefix: '',
        };
        return getStoredStateP(settings);
      }).then((state) => {
        log('info', 'activate game settings', JSON.stringify(state));
        // step 3: update game-specific settings, then return the persistor
        store.dispatch({ type: 'persist/REHYDRATE', payload: state });
        return createPersistor(store, settings);
      });
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
