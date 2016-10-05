import { discoveryFinished, discoveryProgress } from '../actions/discovery';
import { setCurrentProfile } from '../actions/profiles';
import { setKnownGames } from '../actions/session';
import { addDiscoveredGame, setGameMode } from '../actions/settings';
import { IGame } from '../types/IGame';
import { IState } from '../types/IState';
import { log } from '../util/log';
import { showError } from '../util/message';
import StorageLogger from '../util/StorageLogger';

import { terminate } from './errorHandling';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { Persistor, createPersistor, getStoredState } from 'redux-persist';
import { AsyncNodeStorage } from 'redux-persist-node-storage';

const getStoredStateP = Promise.promisify(getStoredState);

type EmptyCB = () => void;

class Progress {

  private mMagnitude: number;
  private mStepCount: number;
  private mStepsCompleted: number;
  private mBaseValue: number;
  private mCallback: (percent: number, label: string) => void;

  constructor(baseValue: number, magnitude: number,
              callback: (percent: number, label: string) => void) {
    this.mMagnitude = magnitude;
    this.mBaseValue = baseValue;
    this.mCallback = callback;
    this.mStepsCompleted = 0;
  }

  public setStepCount(count: number) {
    this.mStepCount = count;
  }

  public completed(label: string) {
    if (this.mMagnitude > 0.5) {
      this.mStepsCompleted += 1;
      this.mCallback(this.currentProgress(), label);
    }
  }

  public derive() {
    return this.mMagnitude > 0.5
      ? new Progress(this.mBaseValue + this.currentProgress(),
                     this.mMagnitude / this.mStepCount, this.mCallback)
      : undefined;
  }

  private currentProgress() {
    return this.mBaseValue + (this.mMagnitude * this.mStepsCompleted) / this.mStepCount;
  }
}

function walk(searchPath: string,
              matchList: Set<string>,
              blackList: Set<string>,
              resultCB: (path: string) => void,
              progress: Progress) {
  if (blackList.has(searchPath)) {
    return null;
  }

  let statPaths: string[] = [];

  return fs.readdirAsync(searchPath)
    .then((fileNames: string[]) => {
      for (let fileName of fileNames) {
        const filePath = path.join(searchPath, fileName);
        if (matchList.has(fileName)) {
          // notify that a searched file was found. If the CB says so
          // we stop looking at this directory
          resultCB(filePath);
        } else {
          statPaths.push(filePath);
        }
      }

      return Promise.mapSeries(statPaths, (statPath: string) => {
        return fs.statAsync(statPath).reflect();
      });
    }).then((res: Promise.Inspection<fs.Stats>[]) => {
      // use the stats results to generate a list of paths of the directories
      // in the searched directory
      let dirPaths: string[] = res.reduce(
        (prev, cur: Promise.Inspection<fs.Stats>, idx: number) => {
          if (cur.isFulfilled() && cur.value().isDirectory()) {
            return prev.concat(idx);
          } else if (!cur.isFulfilled()) {
            if (cur.reason().code !== 'EPERM') {
              log('warn', 'stat failed', { error: cur.reason() });
            } else {
              log('debug', 'failed to access', { error: cur.reason() });
            }
          }
          return prev;
        }, []);
      if (progress !== undefined) {
        // count number of directories to be used as the step counter in the progress bar
        progress.setStepCount(dirPaths.length);
      }
      // allow the gc to drop the stats results
      res = [];
      if (dirPaths === undefined) {
        return undefined;
      }
      return Promise.mapSeries(dirPaths, (idx) => {
        let subProgess = progress !== undefined ? progress.derive() : undefined;
        if (progress !== undefined) {
          progress.completed(statPaths[idx]);
        }
        return walk(statPaths[idx], matchList, blackList, resultCB, subProgess);
      });
    }).catch((err) => {
      log('warn', 'walk failed', { msg: err.message });
    });
}

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
  private mStore: Redux.Store<IState>;
  private mKnownGames: IGame[];

  constructor(basePath: string) {
    this.mSubscription = null;
    this.mBasePath = basePath;
    this.mPersistor = null;
    this.mError = false;
    this.mStore = null;
    this.mKnownGames = [];
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

    let gamesPath: string = path.resolve(__dirname, '..', 'games');
    let games: IGame[] = this.loadDynamicGames(gamesPath);
    gamesPath = path.join(remote.app.getPath('userData'), 'games');
    this.mKnownGames = games.concat(this.loadDynamicGames(gamesPath));

    this.mStore = store;

    // TODO handle the case where there are games previously discovered that
    //      are now no longer known
    // TODO verify that previously discovered games are still available in
    //      their existing location
    let gamesStored: any[] = this.mKnownGames.map((game: IGame) => {
      return {
        name: game.name,
        id: game.id,
        logo: game.logo,
        pluginPath: game.pluginPath,
      };
    } );
    store.dispatch(setKnownGames(gamesStored));

    this.mSubscription = store.subscribe(() => {
      lastMode = this.testModeChange(lastMode, store);
      this.checkProfile(store);
    });
  }

  /**
   * starts game discovery, only using the search function from the game
   * extension
   * 
   * @memberOf GameModeManager
   */
  public startQuickDiscovery() {
    for (let game of this.mKnownGames) {
      if (game.queryGamePath === undefined) {
        continue;
      }
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
            return null;
          }).catch((err) => {
            log('debug', 'game not found', { id: game.id, err });
          });
        }
      } catch (err) {
        log('warn', 'failed to use game support plugin', { id: game.id, err: err.message });
      }
    }
  }

  /**
   * start game discovery using known files
   * 
   * 
   * @memberOf GameModeManager
   */
  public startSearchDiscovery(progress: (percent: number, label: string) => void): void {
    type FileEntry = {fileName: string, game: IGame};

    let files: FileEntry[] = [];
    let games: { [gameId: string]: string[] } = {};

    this.mKnownGames.forEach((value: IGame) => {
      if (!(value.id in this.mStore.getState().settings.base.discoveredGames)) {
        games[value.id] = value.requiredFiles;
        for (let required of value.requiredFiles) {
          files.push({ fileName: required, game: value });
        }
      }
    }, []);

    // retrieve only the basenames of required files because the walk only ever looks
    // at the last path component of a file
    const matchList: Set<string> = new Set(files.map((entry: FileEntry) => {
      return path.basename(entry.fileName);
    }));

    let progressObj = new Progress(0, 100, (percent: number, label: string) => {
      this.mStore.dispatch(discoveryProgress(percent, label));
    });

    walk('c:', matchList, new Set<string>(), (foundPath: string) => {
      let matches: FileEntry[] = files.filter((entry: FileEntry) => {
        return foundPath.endsWith(entry.fileName);
      });

      for (let match of matches) {
        let testPath: string = foundPath.substring(0, foundPath.length - match.fileName.length);
        let game: IGame = match.game;
        this.testGameDirValid(game, testPath);
      }
      return false;
    }, progressObj).then(() => {
      this.mStore.dispatch(discoveryFinished());
    });
  }

  private testGameDirValid(game: IGame, testPath: string): void {
    Promise.map(game.requiredFiles, (fileName: string) => {
      return fs.statAsync(path.join(testPath, fileName));
    }).then(() => {
      log('info', 'valid', { game: game.id, path: testPath });
      this.mStore.dispatch(addDiscoveredGame(game.id, { path: testPath }));
    }).catch(() => {
      log('info', 'invalid', { game: game.id, path: testPath });
    });
  }

  private checkProfile(store: Redux.Store<IState>) {
    if (store.getState().gameSettings.profiles.currentProfile === undefined) {
      // no profile set, find a fallback if possible
      if ('default' in store.getState().gameSettings.profiles) {
        store.dispatch(setCurrentProfile('default'));
      } else {
        let profiles = Object.keys(store.getState().gameSettings.profiles);
        if (profiles.length > 0) {
          store.dispatch(setCurrentProfile(profiles[0]));
        }
      }
    }
  }

  private testModeChange(lastMode: string, store: Redux.Store<IState>): string {
    let currentMode: string = store.getState().settings.base.gameMode;

    if (currentMode !== lastMode) {
      if (this.mPersistor !== null) {
        // stop old persistor
        this.mPersistor.stop();
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
