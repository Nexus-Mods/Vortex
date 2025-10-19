// TODO: Remove Bluebird import - using native Promise;

import * as fs from './fs';
import { promiseMapSeries, promiseMap } from './promise-helpers';
import { log } from './log';
import { isWindows, isMacOS } from './platform';
import { getSafeCI } from './storeHelper';
import { getCrossoverPaths, getVMwarePaths, getVirtualBoxPaths } from './macVirtualization';

import * as  fsOG from 'fs/promises';
import * as path from 'path';
import { parse } from 'simple-vdf';
const winapi = isWindows() ? (isWindows() ? require('winapi-bindings') : undefined) : undefined;
import { ICustomExecutionInfo, IExecInfo, IGameStore, IGameStoreEntry } from '../types/api';

import opn from './opn';

import { IExtensionApi } from '../types/IExtensionContext';
import { GameEntryNotFound } from '../types/IGameStore';
import getVortexPath from './getVortexPath';
import { getMacOSSteamPath } from './macosPaths';

// const Promise = Bluebird; // removed to avoid TS2529 (duplicate identifier 'Promise')
const STORE_ID = 'steam';
const STORE_NAME = 'Steam';
const STEAM_EXEC = isWindows() ? 'Steam.exe' : 'steam.sh';
const STORE_PRIORITY = 40;

export interface ISteamEntry extends IGameStoreEntry {
  manifestData?: any;
}

/// obsolete, no longer used. But it's exported through the api
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
  public id: string = STORE_ID;
  public name: string = STORE_NAME;
  public priority: number = STORE_PRIORITY;
  private mBaseFolder: Promise<string | undefined>;
  private mCache: Promise<ISteamEntry[]>;

  constructor() {
    if (isWindows()) {
      // windows
      try {
        const steamPath =
          winapi.RegGetValue('HKEY_CURRENT_USER', 'Software\\Valve\\Steam', 'SteamPath');
        this.mBaseFolder = Promise.resolve(steamPath.value as string);
      } catch (err) {
        log('info', 'steam not found', { error: err.message });
        this.mBaseFolder = Promise.resolve(undefined);
      }
    } else if (isMacOS()) {
      // macOS - Check both native and virtualized environments
      this.mBaseFolder = Promise.resolve(this.findMacOSSteamPath());
    } else {
      // linux and others
      this.mBaseFolder = Promise.resolve(path.resolve(getVortexPath('home'), '.steam', 'steam'));
    }
  }

  /**
   * find the first game that matches the specified name pattern
   */
  public findByName(namePattern: string): Promise<ISteamEntry> {
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

  public launchGame(appInfo: any, api?: IExtensionApi): Promise<void> {
    // We expect appInfo to be one of three things at this point:
    //  - The game extension's details object if provided, in which case
    //      we want to extract the steamAppId entry. (preferred case as this
    //      is used by the gameinfo-steam extension as well).
    //  - The steam Id in string form.
    //  - The directory path which contains the game's executable.
    if (this.isCustomExecObject(appInfo) && (appInfo.launchType === 'gamestore')) {
      return this.getPosixPath(appInfo)
        .then(posix => opn(posix).catch(err => Promise.resolve()));
    }
    const info = (!!appInfo.steamAppId)
      ? appInfo.steamAppId.toString() : appInfo;
    return this.getExecInfo(info)
      .then(execInfo =>
        api.runExecutable(execInfo.execPath, execInfo.arguments, {
          cwd: path.dirname(execInfo.execPath),
          suggestDeploy: true,
          shell: true,
        }));
  }

  public getPosixPath(appInfo: any): Promise<string> {
    const posixCommand = `steam://launch/${appInfo.appId}/${appInfo.parameters.join()}`;
    return Promise.resolve(posixCommand);
  }

  public getExecInfo(appInfo: any): Promise<IExecInfo> {
    // Steam uses numeric values to id games internally; if the provided appId
    //  contains path separators, it's a clear indication that the game
    //  extension did not provide a steam id and the starter info object
    //  provided the game executables dirname instead.
    let appId;
    let parameters: string[] = [];
    if (this.isCustomExecObject(appInfo)) {
      appId = appInfo.appId;
      parameters = appInfo.parameters ?? [];
    } else {
      appId = appInfo.toString();
    }

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
          return Promise.reject(new GameEntryNotFound(appId, STORE_ID));
        }
        return this.mBaseFolder.then((basePath) => {
          const steamExec = {
            execPath: path.join(basePath, STEAM_EXEC),
            arguments: ['-applaunch', appId, ...parameters],
          };
          return Promise.resolve(steamExec as IExecInfo);
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
          return Promise.reject(new GameEntryNotFound(Array.isArray(appId) ? appId.join(', ') : appId, STORE_ID));
        } else {
          return Promise.resolve(entry);
        }
      });
  }

  public allGames(): Promise<ISteamEntry[]> {
    if (!this.mCache) {
      this.mCache = this.parseManifests();
    }
    return this.mCache.catch(err => {
      // If cache initialization fails, retry once after a brief delay
      // This helps with timing issues on macOS
      log('warn', 'Steam cache initialization failed, retrying', { error: err.message });
      return new Promise<void>((resolve) => setTimeout(() => resolve(), 200)).then(() => {
        this.mCache = this.parseManifests();
        return this.mCache;
      });
    });
  }

  public getGameStorePath(): Promise<string | undefined> {
    return this.mBaseFolder.then(async (baseFolder) => {
      if (isMacOS()) {
        // On macOS, prefer the system Applications bundle first
        try {
          if (await fs.statAsync('/Applications/Steam.app')) {
            return '/Applications/Steam.app';
          }
        } catch (err) {
          // ignore, fall back to base folder
        }
        if (baseFolder === undefined) {
          return undefined;
        }
        return path.join(baseFolder, 'Steam.app');
      }

      // Other platforms
      if (baseFolder === undefined) {
        return undefined;
      }
      return Promise.resolve(path.join(baseFolder, STEAM_EXEC));
    });
  }

  public reloadGames(): Promise<void> {
    this.mCache = this.parseManifests();
    return Promise.resolve();
  }

  private async findMacOSSteamPath(): Promise<string | undefined> {
    // First check the standard macOS Steam path (Application Support)
    const standardPath = getMacOSSteamPath();
    try {
      if (await fs.statAsync(standardPath)) {
        return standardPath;
      }
    } catch (err) {
      // Standard path not found, continue searching
    }

    // Fallback to legacy ~/.steam/steam folder
    try {
      const fallbackPath = path.resolve(getVortexPath('home'), '.steam', 'steam');
      if (await fs.statAsync(fallbackPath)) {
        return fallbackPath;
      }
    } catch (err) {
      // Fallback not found, continue searching
    }

    // Check for Steam in Crossover bottles
    try {
      const crossoverPaths = await getCrossoverPaths();
      for (const bottlePath of crossoverPaths) {
        // Steam is typically installed in drive_c/Program Files (x86)/Steam
        const crossoverSteamPath = path.join(bottlePath, 'drive_c', 'Program Files (x86)', 'Steam');
        try {
          if (await fs.statAsync(crossoverSteamPath)) {
            return crossoverSteamPath;
          }
        } catch (err) {
          // Continue to next path
        }
      }
    } catch (err) {
      log('debug', 'Failed to check Crossover Steam paths', { error: err.message });
    }

    // Check for Steam in VMware VMs
    try {
      const vmwarePaths = await getVMwarePaths();
      for (const vmPath of vmwarePaths) {
        // Steam might be installed in drive_c/Program Files (x86)/Steam in VMware VMs
        const vmwareSteamPath = path.join(vmPath, 'drive_c', 'Program Files (x86)', 'Steam');
        try {
          if (await fs.statAsync(vmwareSteamPath)) {
            return vmwareSteamPath;
          }
        } catch (err) {
          // Continue to next path
        }
      }
    } catch (err) {
      log('debug', 'Failed to check VMware Steam paths', { error: err.message });
    }

    // Check for Steam in VirtualBox VMs
    try {
      const virtualboxPaths = await getVirtualBoxPaths();
      for (const vmPath of virtualboxPaths) {
        // Steam might be installed in drive_c/Program Files (x86)/Steam in VirtualBox VMs
        const virtualboxSteamPath = path.join(vmPath, 'drive_c', 'Program Files (x86)', 'Steam');
        try {
          if (await fs.statAsync(virtualboxSteamPath)) {
            return virtualboxSteamPath;
          }
        } catch (err) {
          // Continue to next path
        }
      }
    } catch (err) {
      log('debug', 'Failed to check VirtualBox Steam paths', { error: err.message });
    }

    return undefined;
  }

  public identifyGame(gamePath: string,
                      fallback: (gamePath: string) => PromiseLike<boolean>)
                      : Promise<boolean> {
    const custom = gamePath.toLowerCase().split(path.sep).includes('steamapps');

    return Promise.resolve(fallback(gamePath))
      .then((fbResult: boolean) => {
        if (fbResult !== custom) {
          log('warn', '(steam) game identification inconclusive', {
            gamePath,
            custom,
            fallback,
          });
        }
        return custom || fbResult;
      });
  }

  private isCustomExecObject(object: any): object is ICustomExecutionInfo {
    if (typeof(object) !== 'object') {
      return false;
    }
    return ('appId' in object);
  }

  private resolveSteamPaths(): Promise<string[]> {
    log('debug', 'resolving Steam game paths');
    return this.mBaseFolder.then((basePath: string) => {
      if (basePath === undefined) {
        // Steam not found/installed
        return Promise.resolve([]);
      }

      const steamPaths: string[] = [basePath];
      // On Windows, libraryfolders.vdf is typically under `config/`,
      // on macOS/Linux it usually resides under `steamapps/`.
      const primaryLibFile = isWindows()
        ? path.resolve(basePath, 'config', 'libraryfolders.vdf')
        : path.resolve(basePath, 'steamapps', 'libraryfolders.vdf');
      const secondaryLibFile = isWindows()
        ? path.resolve(basePath, 'steamapps', 'libraryfolders.vdf')
        : path.resolve(basePath, 'config', 'libraryfolders.vdf');

      return fs.readFileAsync(primaryLibFile)
        .catch(err => (err && err.code === 'ENOENT')
          ? fs.readFileAsync(secondaryLibFile)
          : Promise.reject(err))
        .then((data: Buffer) => {
          if (data === undefined) {
            return Promise.resolve(steamPaths);
          }
          let parsedObj;
          try {
            parsedObj = parse(data.toString());
          } catch (err) {
            log('warn', 'unable to parse steamfolders.vdf', err);
            return Promise.resolve(steamPaths);
          }
          const libObj: any = getSafeCI(parsedObj, ['libraryfolders'], {});
          let counter = libObj.hasOwnProperty('0') ? 0 : 1;
          while (libObj.hasOwnProperty(`${counter}`)) {
            const libPath = libObj[`${counter}`]['path'];
            if (libPath && !steamPaths.includes(libPath)) {
              steamPaths.push(libObj[`${counter}`]['path']);
            }
            ++counter;
          }
          log('debug', 'found steam install folders', { steamPaths });
          return Promise.resolve(steamPaths);
        })
        .catch(err => {
          // A Steam update has changed the way we resolve the steam library paths
          //  (we used to get these from config.vdf) the libraryfolders.vdf file
          //  appears to at times hold a reference to _all_ library folders; other times
          //  it only holds the path to the alternate steam libraries (the ones that aren't
          //  part of the base Steam installation folder)
          log('warn', 'failed to read steam library folders file', err);
          return ['EPERM', 'ENOENT'].includes(err.code)
            ? Promise.resolve(steamPaths)
            : Promise.reject(err);
        });
    });
  }

  private parseManifests(): Promise<ISteamEntry[]> {
    return this.resolveSteamPaths()
      .then((steamPaths: string[]) => {
        // First, read libraryfolders.vdf to get app-to-library mapping
        return this.getAppLibraryMapping(steamPaths)
          .then((appLibraryMap: Map<string, string>) => {
            return promiseMapSeries(steamPaths, steamPath => {
              log('debug', 'reading steam install folder', { steamPath });
              const steamAppsPath = path.join(steamPath, 'steamapps');
              return Promise.resolve(fsOG.readdir(steamAppsPath))
                .then(names => {
                  const filtered = names.filter(name =>
                    name.startsWith('appmanifest_') && (path.extname(name) === '.acf'));
                  log('debug', 'got steam manifests', { manifests: filtered });
                  return promiseMap(filtered, (name: string) =>
                    fs.readFileAsync(path.join(steamAppsPath, name)).then(manifestData => ({
                      manifestData, name,
                    })));
                })
                .then(appsData => {
                  return appsData
                    .map(appData => {
                      const { name, manifestData } = appData;
                      try {
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
                        const appId = obj['AppState']['appid'];
                        const installDir = obj['AppState']['installdir'];
                        
                        // Use the app-to-library mapping to find the correct library path
                        const correctLibraryPath = appLibraryMap.get(appId) || steamPath;
                        const gamePath = path.join(correctLibraryPath, 'steamapps', 'common', installDir);
                        
                        log('debug', 'resolved game path', { 
                          appId, 
                          installDir, 
                          manifestLibrary: steamPath, 
                          correctLibrary: correctLibraryPath, 
                          gamePath 
                        });
                        
                        return {
                          appid: appId,
                          gameStoreId: STORE_ID,
                          name: obj['AppState']['name'],
                          gamePath: gamePath,
                          lastUser: obj['AppState']['LastOwner'],
                          lastUpdated: new Date(obj['AppState']['LastUpdated'] * 1000),
                          manifestData: obj,
                        } as ISteamEntry;
                      } catch (err) {
                        log('warn', 'failed to parse steam manifest',
                            { name, error: err.message });
                        return undefined;
                      }
                    })
                    .filter(obj => obj !== undefined) as ISteamEntry[];
                })
                .catch(err => { if (err.code === 'ENOENT') {
                  // no biggy, this can happen for example if the steam library is on a removable medium
                  // which is currently removed
                  log('info', 'Steam library not found', { error: err.message });
                  return undefined;
                }})
                .catch(err => {
                  log('warn', 'Failed to read steam library', { path: steamPath, error: err.message });
                  return [] as ISteamEntry[]; // Return empty array instead of undefined
                });
            });
          });
      })
      .then((games: ISteamEntry[][]) =>
        games.reduce((prev: ISteamEntry[], current: ISteamEntry[]): ISteamEntry[] =>
          current !== undefined ? prev.concat(current) : prev, []))
      .then((result: ISteamEntry[]) => {
        log('info', 'done reading steam libraries');
        return result; // Return the result instead of void
      });
  }

  private getAppLibraryMapping(steamPaths: string[]): Promise<Map<string, string>> {
    const appLibraryMap = new Map<string, string>();
    
    // Try to read libraryfolders.vdf from the main Steam installation
    const mainSteamPath = steamPaths[0]; // First path is usually the main Steam installation
    if (!mainSteamPath) {
      return Promise.resolve(appLibraryMap);
    }
    
    const libFoldersFile = isWindows()
      ? path.resolve(mainSteamPath, 'config', 'libraryfolders.vdf')
      : path.resolve(mainSteamPath, 'steamapps', 'libraryfolders.vdf');
    
    return fs.readFileAsync(libFoldersFile)
      .then((data: Buffer) => {
        try {
          const parsedObj = parse(data.toString());
          const libObj: any = getSafeCI(parsedObj, ['libraryfolders'], {});
          
          // Iterate through each library folder
          let counter = libObj.hasOwnProperty('0') ? 0 : 1;
          while (libObj.hasOwnProperty(`${counter}`)) {
            const libraryEntry = libObj[`${counter}`];
            const libraryPath = libraryEntry['path'];
            const apps = libraryEntry['apps'] || {};
            
            // Map each app ID to this library path
            Object.keys(apps).forEach(appId => {
              appLibraryMap.set(appId, libraryPath);
            });
            
            log('debug', 'mapped apps to library', { 
              libraryPath, 
              appCount: Object.keys(apps).length,
              apps: Object.keys(apps)
            });
            
            ++counter;
          }
          
          log('debug', 'created app-to-library mapping', { 
            totalApps: appLibraryMap.size,
            libraries: Array.from(new Set(appLibraryMap.values()))
          });
          
          return appLibraryMap;
        } catch (err) {
          log('warn', 'failed to parse libraryfolders.vdf for app mapping', err);
          return appLibraryMap;
        }
      })
      .catch(err => {
        log('warn', 'failed to read libraryfolders.vdf for app mapping', err);
        return appLibraryMap;
      });
  }
}

const instance: IGameStore = new Steam();

export default instance;