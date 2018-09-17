import * as Promise from 'bluebird';
import * as Registry from 'winreg';

import * as fs from './fs';
import { log } from './log';
import { getSafeCI } from './storeHelper';

import * as path from 'path';
import { parse } from 'simple-vdf';


import {homedir} from 'os';

export interface ISteamEntry {
  appid: string;
  name: string;
  gamePath: string;
  lastUpdated: Date;
}

export class GameNotFound extends Error {
  constructor(search: string) {
    super(`game not found: ${search}`);
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
  }
}

export interface ISteam {
  findByName(namePattern: string): Promise<ISteamEntry>;
  findByAppId(appId: string | string[]): Promise<ISteamEntry>;
  allGames(): Promise<ISteamEntry[]>;
}

/**
 * base class to interact with local steam installation
 *
 * @class Steam
 */
class Steam implements ISteam {
  public static GameNotFound = GameNotFound;
  private mBaseFolder: Promise<string>;
  private mCache: ISteamEntry[];

  constructor() {
    if (process.platform === 'win32') {
        // windows
        const regKey = new Registry({
          hive: Registry.HKCU,
          key: '\\Software\\Valve\\Steam',
        });

        this.mBaseFolder = new Promise<string>((resolve, reject) => {
          try {
            regKey.get('SteamPath',
              (err: Error, result: Registry.RegistryItem) => {
                if (err !== null) {
                  // hrm, if we notify the user about this, users without Steam will be
                  // annoyed. If we don't, the lack of steam functionality may confuse
                  // those who do have it. Well, it's their own fault for breaking
                  // the registry keys really...
                  log('info', 'steam not found', { error: err.message });
                  resolve(undefined);
                } else if (result === null) {
                  log('info', 'steam not found');
                  resolve(undefined);
                } else {
                  resolve(result.value);
                }
              });
          } catch (err) {
            log('warn', 'steam not found', { error: err.message });
            resolve(undefined);
          }
        });
    } else {
      this.mBaseFolder = Promise.resolve(path.resolve(homedir(), '.steam', 'steam'));
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
      .then(entries => entries.find(matcher))
      .then(entry => {
        if (entry === undefined) {
          return Promise.reject(new GameNotFound(Array.isArray(appId) ? appId.join(', ') : appId));
        } else {
          return Promise.resolve(entry);
        }
      });
  }

  public allGames(): Promise<ISteamEntry[]> {
    if (this.mCache !== undefined) {
      return Promise.resolve(this.mCache);
    }
    return this.parseManifests().tap(entries => { this.mCache = entries; });
  }

  private parseManifests(): Promise<ISteamEntry[]> {
    const steamPaths: string[] = [];
    return this.mBaseFolder
      .then((basePath: string) => {
        if (basePath === undefined) {
          return Promise.resolve(undefined);
        }
        steamPaths.push(basePath);
        return fs.readFileAsync(path.resolve(basePath, 'config', 'config.vdf'));
      })
      .then((data: NodeBuffer) => {
        if (data === undefined) {
          return Promise.resolve([]);
        }
        const configObj: any = parse(data.toString());

        let counter = 1;
        const steamObj: any =
          getSafeCI(configObj, ['InstallConfigStore', 'Software', 'Valve', 'Steam'], {});
        while (steamObj.hasOwnProperty(`BaseInstallFolder_${counter}`)) {
          steamPaths.push(steamObj[`BaseInstallFolder_${counter}`]);
          ++counter;
        }

        return Promise.all(Promise.map(steamPaths, steamPath => {
          const steamAppsPath = path.join(steamPath, 'steamapps');
          return fs.readdirAsync(steamAppsPath)
            .then(names => {
              const filtered = names.filter(name =>
                name.startsWith('appmanifest_') && (path.extname(name) === '.acf'));
              return Promise.map(filtered, (name: string) =>
                fs.readFileAsync(path.join(steamAppsPath, name)));
            })
            .then((appsData: NodeBuffer[]) => {
              return appsData.map(appData => parse(appData.toString())).map(obj =>
                ({
                  appid: obj['AppState']['appid'],
                  name: obj['AppState']['name'],
                  gamePath: path.join(steamAppsPath, 'common', obj['AppState']['installdir']),
                  lastUpdated: new Date(obj['AppState']['LastUpdated'] * 1000),
                }));
            });
        }));
      })
      .then((games: ISteamEntry[][]) =>
        games.reduce((prev: ISteamEntry[], current: ISteamEntry[]): ISteamEntry[] =>
          prev.concat(current)));
  }
}

const instance: ISteam = new Steam();

export default instance;
