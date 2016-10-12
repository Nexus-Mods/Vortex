import { IGame } from '../../types/IGame';
import { terminate } from '../../util/errorHandling';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import StorageLogger from '../../util/StorageLogger';

import { ISupportedTools } from '../../types/ISupportedTools';

import { discoveryFinished, discoveryProgress } from './actions/discovery';
import { setKnownGames } from './actions/session';
import { addDiscoveredGame, setGameMode, addDiscoveredTool } from './actions/settings';
import { IDiscoveryResult, IGameStored, IStateEx, IToolDiscoveryResult } from './types/IStateEx';
import { discoverTools, quickDiscovery, searchDiscovery } from './util/discovery';
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

  private mSubscription: Redux.Unsubscribe;
  private mBasePath: string;
  private mPersistor: Persistor;
  private mError: boolean;
  private mStore: Redux.Store<IStateEx>;
  private mKnownGames: IGame[];
  private mKnownTools: ISupportedTools[];
  private mActiveSearch: Promise<any[]>;

  constructor(basePath: string) {
    this.mSubscription = null;
    this.mBasePath = basePath;
    this.mPersistor = null;
    this.mError = false;
    this.mStore = null;
    this.mKnownGames = [];
    this.mKnownTools = [];
    this.mActiveSearch = null;
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
    let gamesStored: IGameStored[] = this.mKnownGames.map((game: IGame) => {
      return {
        name: game.name,
        id: game.id,
        logo: game.logo,
        modPath: game.queryModPath(),
        pluginPath: game.pluginPath,
        requiredFiles: game.requiredFiles,
        supportedTools: game.supportedTools,
      };
    } );
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
    log('info', 'changed game mode', { oldMode, newMode });
    if (this.mPersistor !== null) {
      // stop old persistor
      this.mPersistor.stop();
    }
    this.activateGameMode(newMode, this.mStore)
      .then((persistor) => {
        log('debug', 'activated game mode', { newMode });
        this.mPersistor = persistor;
        this.mError = false;
      }).catch((err) => {
        if (!this.mError) {
          // first error, try reverting to the previous game mode
          this.mError = true;
          showError(this.mStore.dispatch, 'Failed to change game mode', err);
          this.mStore.dispatch(setGameMode(oldMode));
        } else {
          terminate({ message: 'Failed to change game mode', details: err });
        }
      });
  }

  /**
   * starts game discovery, only using the search function from the game
   * extension
   * 
   * @memberOf GameModeManager
   */
  public startQuickDiscovery() {
    quickDiscovery(this.mKnownGames, this.onDiscoveredGame);
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
      this.onDiscoveredGame, progress)
    .finally(() => {
      this.mStore.dispatch(discoveryFinished());
    });
  }

  public stopSearchDiscovery(): void {
    log('info', 'stop search', { prom: this.mActiveSearch });
    this.mActiveSearch.cancel();
  }

  private onDiscoveredTool = (gameId: string, result: IToolDiscoveryResult) => {
    log('info', 'found tool', { name: result.toolName, gameId, path: result.path });
    this.mStore.dispatch(addDiscoveredTool(gameId));
  }

  private onDiscoveredGame = (gameId: string, result: IDiscoveryResult) => {
    if (!path.isAbsolute(result.modPath)) {
      result.modPath = path.resolve(result.path, result.modPath);
    }
    this.mStore.dispatch(addDiscoveredGame(gameId, result));
    discoverTools(this.mKnownGames.find((game: IGame) => game.id === gameId),
                  this.onDiscoveredTool);
  }

  private activateGameMode(mode: string, store: Redux.Store<IStateEx>): Promise<Persistor> {
    if (mode === undefined) {
      return null;
    }

    const statePath: string = path.join(this.mBasePath, mode, 'state');

    let settings = undefined;

    return fs.ensureDirAsync(statePath)
      .then(() => {
        // step 2: retrieve stored state
        settings = {
          storage: new StorageLogger(new AsyncNodeStorage(statePath)),
          whitelist: ['gameSettings'],
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
