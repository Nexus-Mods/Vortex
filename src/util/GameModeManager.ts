import { setGameSettings } from '../actions/gameSettings';
import { setKnownGames } from '../actions/session';
import { addDiscoveredGame, setGameMode } from '../actions/settings';
import { IGame } from '../types/IGame';
import { IDiscoveryResult, IState } from '../types/IState';
import { log } from '../util/log';
import { showError } from '../util/message';

import { terminate } from './errorHandling';

import * as Promise from 'bluebird';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Persistor, createPersistor, getStoredState } from 'redux-persist';
import { AsyncNodeStorage } from 'redux-persist-node-storage';

const getStoredStateP = Promise.promisify(getStoredState);

class GameModeManager {

  private mSubscription: Redux.Unsubscribe;
  private mBasePath: string;
  private mPersistor: Persistor;
  private mError: boolean;
  private mStore: Redux.Store<IState>;

  constructor(basePath: string) {
    this.mSubscription = null;
    this.mBasePath = basePath;
    this.mPersistor = null;
    this.mError = false;
    this.mStore = null;
  }

  /**
   * attach this manager to the specified store
   * 
   * @param {Redux.Store<IState>} store
   * 
   * @memberOf GameModeManager
   */
  public attachToStore(store: Redux.Store<IState>) {
    let lastMode: string = undefined;

    let appBasePath = app.getAppPath();

    if (process.env.NODE_ENV === 'development') {
      appBasePath = path.join(appBasePath, 'out');
    }

    let gamesPath: string = path.join(appBasePath, 'games');
    let games: IGame[] = this.loadDynamicGames(gamesPath);
    gamesPath = path.join(app.getPath('userData'), 'games');
    games = games.concat(this.loadDynamicGames(gamesPath));

    this.mStore = store;

    // TODO handle the case where there are games previously discovered that
    //      are now no longer known
    // TODO verify that previously discovered games are still available in
    //      their existing location
    store.dispatch(setKnownGames(games));

    this.mSubscription = store.subscribe(() => {
      lastMode = this.testModeChange(lastMode, store);
    });
  }

  /**
   * starts game discovery, only using the game
   * 
   * @memberOf GameModeManager
   */
  public startQuickDiscovery() {
    for (let game of this.mStore.getState().session.knownGames) {
      try {
        let gamePath = game.queryGamePath();
        if (typeof (gamePath) === 'string') {
          if (gamePath !== '') {
            log('info', 'found game', { name: game.name, location: gamePath });
            this.mStore.dispatch(addDiscoveredGame(game.id, { path: gamePath }));
          } else {
            log('debug', 'game not found', game.id);
          }
        } else {
          (gamePath as Promise<string>).then((resolvedPath) => {
            log('info', 'found game', { name: game.name, location: resolvedPath });
            this.mStore.dispatch(addDiscoveredGame(game.id, { path: resolvedPath }));
          }).catch((err) => {
            log('debug', 'game not found', { id: game.id, err });
          });
        }
      } catch (err) {
        log('warn', 'failed to use game support plugin', { id: game.id, err: err.message });
      }
    }
  }

  private testModeChange(lastMode: string, store: Redux.Store<IState>): string {
      let currentMode = store.getState().settings.base.gameMode;
      if (currentMode !== lastMode) {
        if (this.mPersistor !== null) {
          // stop old persistor
          this.mPersistor.pause();
        }
        this.activateGameMode(currentMode, store)
        .then((persistor) => {
          this.mPersistor = persistor;
          this.mError = false;
        }).catch((err) => {
          if (!this.mError) {
            // first error, try reverting to the previous game mode
            this.mError = true;
            showError(store.dispatch, 'Failed to change game mode', err);
            store.dispatch(setGameMode(lastMode));
          } else {
            terminate({ message: 'Failed to change game mode', details: err });
          }
        });
      }
      return currentMode;
  }

  private activateGameMode(mode: string, store: Redux.Store<IState>): Promise<Persistor> {
    let settings = {
      storage: new AsyncNodeStorage(path.join(this.mBasePath, mode, 'state')),
      whitelist: ['gameSettings'],
    };

    return new Promise<Persistor>((resolve, reject) => {
      getStoredStateP(settings)
      .then((state) => {
        store.dispatch(setGameSettings(state));
        resolve(createPersistor(store, settings));
      }).catch((err) => {
        reject(err);
      });
    });
  }

  private loadDynamicGame(extensionPath: string): IGame {
    log('info', 'loading game support from', extensionPath);
    let indexPath = path.join(extensionPath, 'index.js');
    if (fs.existsSync(indexPath)) {
      let res: IGame = require(indexPath).default;
      res.pluginPath = extensionPath;
      log('info', 'pluginpath a', res.pluginPath);
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
