import { log } from './log';

import Promise from 'bluebird';
import * as path from 'path';
const winapiT = isWindows() ? (isWindows() ? require('winapi-bindings') : undefined) : undefined;
import * as fs from './fs';
import { getSafe } from './storeHelper';
import getVortexPath from './getVortexPath';

import opn from './opn';
import { isWindows, isMacOS, isLinux, getWineDriveCPath, platformSwitch } from './platform';

import { GameEntryNotFound, IExtensionApi, IGameStore, IGameStoreEntry } from '../types/api';
import lazyRequire from './lazyRequire';

const winapi: typeof winapiT = lazyRequire(() => (isWindows() ? require('winapi-bindings') : undefined));

const STORE_ID = 'gog';

class GOGGalaxy implements IGameStore {
  public id: string = STORE_ID;
  private mDataPath: Promise<string | undefined>;
  private mLauncherExecPath: string;
  private mCache: Promise<IGameStoreEntry[]>;

  constructor() {
    this.mDataPath = this.getGOGDataPath();
  }

  private getGOGDataPath(): Promise<string | undefined> {
    return platformSwitch({
      win32: () => {
        try {
          // GOG Galaxy stores game data in ProgramData
          const gogDataPath = path.join('C:', 'ProgramData', 'GOG.com', 'Galaxy');
          return fs.statAsync(gogDataPath)
            .then(() => gogDataPath)
            .catch(() => {
              log('info', 'GOG Galaxy not found on Windows');
              return Promise.reject(new Error('GOG Galaxy not found'));
            });
        } catch (err) {
          log('info', 'GOG Galaxy not found', { error: err.message });
          return Promise.resolve(undefined);
        }
      },
      darwin: () => {
        // macOS: GOG Galaxy stores data in ~/Library/Application Support/GOG.com
        const gogDataPath = path.join(getVortexPath('home'), 'Library', 'Application Support', 'GOG.com', 'Galaxy');
        return fs.statAsync(gogDataPath)
          .then(() => gogDataPath)
          .catch(() => {
            log('info', 'GOG Galaxy not found on macOS');
            return Promise.reject(new Error('GOG Galaxy not found in default location'));
          });
      },
      linux: () => {
        // Linux with Wine
        const wineDriveC = getWineDriveCPath();
        const gogDataPath = path.join(wineDriveC, 'users', 'Public', 'GOG.com', 'Galaxy');
        return fs.statAsync(gogDataPath)
          .then(() => gogDataPath)
          .catch(() => {
            log('info', 'GOG Galaxy not found on Linux');
            return undefined;
          });
      }
    });
  }

  public allGames(): Promise<IGameStoreEntry[]> {
    if (!this.mCache) {
      this.mCache = this.parseManifests();
    }
    return this.mCache;
  }

  public reloadGames(): Promise<void> {
    return new Promise((resolve) => {
      this.mCache = this.parseManifests();
      return resolve();
    });
  }

  public findByAppId(appId: string | string[]): Promise<IGameStoreEntry> {
    const matcher = Array.isArray(appId)
      ? entry => appId.indexOf(entry.appid) !== -1
      : entry => entry.appid === appId;

    return this.allGames()
      .then(entries => {
        const entry = entries.find(matcher);
        if (entry === undefined) {
          return Promise.reject(new GameEntryNotFound(Array.isArray(appId) ? appId.join(', ') : appId, STORE_ID));
        } else {
          return Promise.resolve(entry);
        }
      });
  }

  public findByName(namePattern: string): Promise<IGameStoreEntry> {
    const re = new RegExp('^' + namePattern + '$');
    return this.allGames()
      .then(entries => entries.find(entry => re.test(entry.name)))
      .then(entry => {
        if (entry === undefined) {
          return Promise.reject(new GameEntryNotFound(namePattern, STORE_ID));
        } else {
          return Promise.resolve(entry);
        }
      });
  }

  public getGameStorePath(): Promise<string> {
    const getExecPath = () => {
      return platformSwitch({
        win32: () => {
          try {
            // Try to find GOG Galaxy in registry
            const gogLauncher = winapi?.RegGetValue?.('HKEY_LOCAL_MACHINE',
              'SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient\\paths',
              'client');
            const val = gogLauncher.value;
            this.mLauncherExecPath = path.join(val.toString(), 'GalaxyClient.exe');
            return Promise.resolve(this.mLauncherExecPath);
          } catch (err) {
            // Fallback to default installation path
            const defaultPath = path.join('C:', 'Program Files (x86)', 'GOG Galaxy', 'GalaxyClient.exe');
            return fs.statAsync(defaultPath)
              .then(() => {
                this.mLauncherExecPath = defaultPath;
                return Promise.resolve(defaultPath);
              })
              .catch(() => {
                log('info', 'GOG Galaxy not found in default location');
                return Promise.reject(new Error('GOG Galaxy not found'));
              });
          }
        },
        darwin: () => {
          // macOS: GOG Galaxy is typically in /Applications
          const gogAppPath = '/Applications/GOG Galaxy.app';
          return fs.statAsync(gogAppPath)
            .then(() => {
              this.mLauncherExecPath = gogAppPath;
              return Promise.resolve(gogAppPath);
            })
            .catch(() => {
              log('info', 'GOG Galaxy not found in /Applications');
              return Promise.reject(new Error('GOG Galaxy not found in /Applications'));
            });
        },
        linux: () => {
          // Linux with Wine
          const wineDriveC = getWineDriveCPath();
          const wineGogPath = path.join(wineDriveC, 'Program Files (x86)', 'GOG Galaxy', 'GalaxyClient.exe');
          return fs.statAsync(wineGogPath)
            .then(() => {
              this.mLauncherExecPath = wineGogPath;
              return Promise.resolve(wineGogPath);
            })
            .catch(() => {
              log('info', 'GOG Galaxy not found in Wine prefix');
              return Promise.reject(new Error('GOG Galaxy not found in Wine prefix'));
            });
        }
      });
    };

    return (!!this.mLauncherExecPath)
      ? Promise.resolve(this.mLauncherExecPath)
      : getExecPath();
  }

  public launchGame(appId: string, api?: IExtensionApi): Promise<void> {
    return this.getGameStorePath()
      .then(storePath => {
        if (storePath === undefined) {
          return Promise.reject(new GameEntryNotFound(appId, STORE_ID));
        }
        const args = [`/gameId=${appId}`, '/command=runGame'];
        return opn(storePath, false).catch(err => Promise.resolve());
      });
  }

  private executable() {
    if (isWindows()) {
      return 'GalaxyClient.exe';
    } else if (isMacOS()) {
      return 'GOG Galaxy.app';
    } else {
      // Linux
      return 'gogalaxy';
    }
  }

  private parseManifests(): Promise<IGameStoreEntry[]> {
    return this.mDataPath
      .then(dataPath => {
        if (dataPath === undefined) {
          return Promise.resolve([]);
        }

        // GOG Galaxy stores game information in storage/installed.db (SQLite)
        // For simplicity, we'll look for game folders in the games directory
        const gamesPath = path.join(dataPath, 'games');
        return fs.readdirAsync(gamesPath)
          .catch({ code: 'ENOENT' }, err => {
            log('info', 'GOG Galaxy games directory not found', err.code);
            return [];
          });
      })
      .then(gameIds => {
        if (gameIds.length === 0) {
          return Promise.resolve([]);
        }

        return Promise.map(gameIds, gameId => {
          return this.mDataPath.then(dataPath => {
            if (!dataPath) {
              return Promise.reject(new Error('GOG Galaxy data path not found'));
            }
            const gameInfoPath = path.join(dataPath, 'games', gameId, 'gameinfo');
            return fs.readFileAsync(gameInfoPath, { encoding: 'utf8' })
              .then(data => {
                try {
                  const parsed = JSON.parse(data);
                  const gameStoreId = STORE_ID;
                  const name = getSafe(parsed, ['name'], undefined) || getSafe(parsed, ['title'], undefined);
                  const gamePath = getSafe(parsed, ['installDirectory'], undefined);
                  const appid = getSafe(parsed, ['gameId'], undefined) || gameId;

                  return (!!gamePath && !!name && !!appid)
                    ? fs.statAsync(gamePath)
                        .then(() => Promise.resolve({ appid, name, gamePath, gameStoreId }))
                        .catch(() => Promise.resolve(undefined))
                    : Promise.resolve(undefined);
                } catch (err) {
                  log('error', 'Cannot parse GOG Galaxy game info', err);
                  return Promise.resolve(undefined);
                }
              })
              .catch(err => {
                log('debug', 'Cannot read GOG Galaxy game info', { gameId, error: err.message });
                return Promise.resolve(undefined);
              });
          });
        });
      })
      .then((games) => games.filter(game => game !== undefined))
      .catch(err => {
        log('error', 'Failed to parse GOG Galaxy games', err);
        return Promise.resolve([]);
      });
  }
}

const instance: IGameStore = new GOGGalaxy();

export default instance;