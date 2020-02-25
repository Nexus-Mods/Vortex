import Promise from 'bluebird';

import * as fs from './fs';
import { log } from './log';
import { getSafeCI } from './storeHelper';

import { app as appIn, remote } from 'electron';
import * as path from 'path';
import { parse } from 'simple-vdf';
import * as winapi from 'winapi-bindings';
import { IExecInfo, IGameStore, IGameStoreEntry } from '../types/api';

import { IExtensionApi } from '../types/IExtensionContext';

const app = (remote !== undefined) ? remote.app : appIn;

const STORE_ID = 'steam';
const STEAM_EXEC = 'Steam.exe';

export interface ISteamEntry extends IGameStoreEntry {}

export class GameNotFound extends Error {
  private mSearch;
  constructor(search: string) {
    super('Not in Steam library');
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.mSearch = search;
  }
  public get search() {
    return this.mSearch;
  }
}

/**
 * base class to interact with local steam installation
 * @class Steam
 */
class Steam implements IGameStore {
  public static GameNotFound = GameNotFound;
  public id: string;
  private mBaseFolder: Promise<string>;
  private mCache: Promise<ISteamEntry[]>;

  constructor() {
    this.id = STORE_ID;
    if (process.platform === 'win32') {
        // windows
        try {
          const steamPath =
            winapi.RegGetValue('HKEY_CURRENT_USER', 'Software\\Valve\\Steam', 'SteamPath');
          this.mBaseFolder = Promise.resolve(steamPath.value as string);
        } catch (err) {
          log('info', 'steam not found', { error: err.message });
          this.mBaseFolder = Promise.resolve(undefined);
        }
    } else {
      this.mBaseFolder = Promise.resolve(path.resolve(app.getPath('home'), '.steam', 'steam'));
    }
  }

  /**
   * find the first game that matches the specified name pattern
   */
  public findByName(namePattern: string): Promise<ISteamEntry> {
    const re = new RegExp(namePattern);
    return this.allGames()
      .then(entries => entries.find(entry => re.test(entry.name)))
      .then(entry => {
        if (entry === undefined) {
          return Promise.reject(new Steam.GameNotFound(namePattern));
        } else {
          return Promise.resolve(entry);
        }
      });
  }

  public launchGame(appInfo: any, api?: IExtensionApi): Promise<void> {
    // We expect appInfo to be one of three things at this point:
    //  - The game extension's details object if provided, in which case
    //      we want to extract the steamAppId entry. (preferred case as this
    //      is used by the gameinfo-steam extension as well).
    //  - The steam Id in string form.
    //  - The directory path which contains the game's executable.
    const info = (!!appInfo.steamAppId)
      ? appInfo.steamAppId.toString() : appInfo.toString();
    return this.getExecInfo(info)
      .then(execInfo =>
        api.runExecutable(execInfo.execPath, execInfo.arguments, {
          cwd: path.dirname(execInfo.execPath),
          suggestDeploy: true,
          shell: true,
      }));
  }

  public getExecInfo(appId: string): Promise<IExecInfo> {
    // Steam uses numeric values to id games internally; if the provided appId
    //  contains path separators, it's a clear indication that the game
    //  extension did not provide a steam id and the starter info object
    //  provided the game executables dirname instead.
    const isDirPath = (appId.indexOf(path.sep) !== -1);
    return this.allGames()
      .then(entries => {
        const found = entries.find(entry => (!isDirPath)
          ? (entry.appid === appId)
          // Checking by gamepath is inefficient but I can't think of a different
          //  way to ascertain whether the launcher has this game entry with the
          //  provided information...
          : (appId.toLowerCase().indexOf(entry.gamePath.toLowerCase()) !== -1));
        if (found === undefined) {
          return Promise.reject(new GameNotFound(appId));
        }
        return this.mBaseFolder.then((basePath) => {
          const steamExec = {
            execPath: path.join(basePath, STEAM_EXEC),
            arguments: ['-applaunch', appId],
          };
          return Promise.resolve(steamExec);
        });
      });
  }

  /**
   * find the first game with the specified appid or one of the specified appids
   */
  public findByAppId(appId: string | string[]): Promise<ISteamEntry> {
    // support searching for one app id or one out of a list (when there are multiple
    // variants of a game)
    const matcher = Array.isArray(appId)
      ? entry => appId.indexOf(entry.appid) !== -1
      : entry => entry.appid === appId;

    return this.allGames()
      .then(entries => {
        const entry = entries.find(matcher);
        if (entry === undefined) {
          return Promise.reject(new GameNotFound(Array.isArray(appId) ? appId.join(', ') : appId));
        } else {
          return Promise.resolve(entry);
        }
      });
  }

  public allGames(): Promise<ISteamEntry[]> {
    if (!this.mCache) {
      this.mCache = this.parseManifests();
    }
    return this.mCache;
  }

  private parseManifests(): Promise<ISteamEntry[]> {
    log('debug', 'parsing steam manifest');
    const start = Date.now();
    const steamPaths: string[] = [];
    return this.mBaseFolder
      .then((basePath: string) => {
        if (basePath === undefined) {
          return Promise.resolve(undefined);
        }
        steamPaths.push(basePath);
        return fs.readFileAsync(path.resolve(basePath, 'config', 'config.vdf'));
      })
      .then((data: Buffer) => {
        if (data === undefined) {
          return Promise.resolve([]);
        }

        let configObj;
        try {
          configObj = parse(data.toString());
        } catch (err) {
          return Promise.resolve([]);
        }

        log('debug', 'steam config parsed', { seconds: (Date.now() - start) / 1000 });

        let counter = 1;
        const steamObj: any =
          getSafeCI(configObj, ['InstallConfigStore', 'Software', 'Valve', 'Steam'], {});
        while (steamObj.hasOwnProperty(`BaseInstallFolder_${counter}`)) {
          steamPaths.push(steamObj[`BaseInstallFolder_${counter}`]);
          ++counter;
        }
        log('debug', 'found steam install folders', { steamPaths });

        return Promise.mapSeries(steamPaths, steamPath => {
          log('debug', 'reading steam install folder', { steamPath });
          const steamAppsPath = path.join(steamPath, 'steamapps');
          return fs.readdirAsync(steamAppsPath)
            .then(names => {
              const filtered = names.filter(name =>
                name.startsWith('appmanifest_') && (path.extname(name) === '.acf'));
              log('debug', 'got steam manifests', { manifests: filtered });
              return Promise.map(filtered, (name: string) =>
                fs.readFileAsync(path.join(steamAppsPath, name)).then(manifestData => ({
                  manifestData, name,
                })));
            })
            .then(appsData => {
              return appsData
                .map(appData => {
                  const { name, manifestData } = appData;
                  try {
                    log('debug', 'parsing steam manifest', { name });
                    return { obj: parse(manifestData.toString()), name };
                  } catch (err) {
                    log('warn', 'failed to parse steam manifest',
                        { name, error: err.message });
                    return undefined;
                  }
                })
                .map(res => {
                  if (res === undefined) {
                    return undefined;
                  }
                  const { obj, name } = res;
                  if ((obj === undefined)
                      || (obj['AppState'] === undefined)
                      || (obj['AppState']['installdir'] === undefined)) {
                    log('debug', 'invalid appmanifest', name);
                    return undefined;
                  }
                  try {
                    return {
                      appid: obj['AppState']['appid'],
                      gameStoreId: STORE_ID,
                      name: obj['AppState']['name'],
                      gamePath: path.join(steamAppsPath, 'common', obj['AppState']['installdir']),
                      lastUser: obj['AppState']['LastOwner'],
                      lastUpdated: new Date(obj['AppState']['LastUpdated'] * 1000),
                    };
                  } catch (err) {
                    log('warn', 'failed to parse steam manifest',
                        { name, error: err.message });
                    return undefined;
                  }
                })
                .filter(obj => obj !== undefined);
            })
            .catch({ code: 'ENOENT' }, (err: any) => {
              // no biggy, this can happen for example if the steam library is on a removable medium
              // which is currently removed
              log('info', 'Steam library not found', { error: err.message });
            })
            .catch(err => {
              log('warn', 'Failed to read steam library', err.message);
            });
        });
      })
      .then((games: ISteamEntry[][]) =>
        games.reduce((prev: ISteamEntry[], current: ISteamEntry[]): ISteamEntry[] =>
          current !== undefined ? prev.concat(current) : prev, []))
      .tap(() => {
        log('info', 'done reading steam libraries');
      });
  }
}

const instance: IGameStore = new Steam();

export default instance;
