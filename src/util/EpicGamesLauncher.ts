import { log } from './log';

import * as Promise from 'bluebird';
import * as path from 'path';
import IniParser, { WinapiFormat } from 'vortex-parse-ini';
import * as winapi from 'winapi-bindings';
import * as fs from './fs';
import { getSafe } from './storeHelper';

const ITEM_EXT = '.item';

export interface IEpicEntry {
  appid: string;
  name: string;
  gamePath: string;
}

export interface IEpicGamesLauncher {
  isGameInstalled(name: string): Promise<boolean>;
  findByName(name: string): Promise<IEpicEntry>;
  allGames(): Promise<IEpicEntry[]>;
}

export class EpicGameNotFound extends Error {
  private mName;
  constructor(name: string) {
    super('Not in Epic library');
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.mName = name;
  }
  public get epicName() {
    return this.mName;
  }
}

/**
 * very limited functionality atm because so far the only source of information
 * I found was this ini file, and it contains no meta data about the games, not
 * even the installation path
 */
class EpicGamesLauncher implements IEpicGamesLauncher {
  private mConfig: Promise<{ data: any }>;
  private mDataPath: Promise<string>;
  private mCache: Promise<IEpicEntry[]>;

  constructor() {
    if (process.platform === 'win32') {
      try {
        const epicDataPath = winapi.RegGetValue('HKEY_LOCAL_MACHINE',
          'SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher',
          'AppDataPath');
        this.mDataPath = Promise.resolve(epicDataPath.value as string);
      } catch (err) {
        log('info', 'Epic games launcher not found', { error: err.message });
        this.mDataPath = Promise.resolve(undefined);
      }
    } else {
      // TODO: Is epic launcher even available on non-windows platforms?
      this.mDataPath = Promise.resolve(undefined);
    }
  }

  /**
   * test if a game is installed through the launcher.
   * Please keep in mind that epic seems to internally give third-party games animal names. Kinky.
   * @param name
   */
  public isGameInstalled(name: string): Promise<boolean> {
    return this.config.then(ini => {
      if (ini.data === undefined) {
        return false;
      }
      const settingsKey = Object.keys(ini.data).find(key => key.endsWith('_Settings'));
      if (ini.data[settingsKey] === undefined) {
        return false;
      }
      return Object.keys(ini.data[settingsKey]).indexOf(`${name}_AutoUpdate`) !== -1;
    });
  }

  /**
   * Try to find the epic entry object using Epic's internal naming convention.
   *  e.g. "Flour" === "Untitled Goose Game" lol
   * @param name
   */
  public findByName(name: string): Promise<IEpicEntry> {
    const re = new RegExp(name);
    return this.allGames()
      .then(entries => entries.find(entry => re.test(entry.name)))
      .then(entry => entry === undefined
        ? Promise.reject(new EpicGameNotFound(name))
        : Promise.resolve(entry));
  }

  /**
   * find the first game with the specified appid or one of the specified appids
   */
  public findByAppId(appId: string | string[]): Promise<IEpicEntry> {
    // support searching for one app id or one out of a list (when there are multiple
    // variants of a game)
    const matcher = Array.isArray(appId)
      ? entry => appId.indexOf(entry.appid) !== -1
      : entry => entry.appid === appId;

    return this.allGames()
      .then(entries => entries.find(matcher))
      .then(entry => {
        if (entry === undefined) {
          return Promise.reject(new EpicGameNotFound(Array.isArray(appId)
            ? appId.join(', ') : appId));
        } else {
          return Promise.resolve(entry);
        }
      });
  }

  public allGames(): Promise<IEpicEntry[]> {
    if (this.mCache === undefined) {
      this.mCache = this.parseManifests();
    }
    return this.mCache;
  }

  private parseManifests(): Promise<IEpicEntry[]> {
    let manifestsLocation;
    return this.mDataPath
      .then(dataPath => {
        manifestsLocation = path.join(dataPath, 'Manifests');
        return fs.readdirAsync(manifestsLocation);
      })
      .catch({ code: 'ENOENT' }, err => {
        log('info', 'Epic launcher manifests could not be found', err.code);
        return Promise.resolve([]);
      })
      .then(entries => {
        const manifests = entries.filter(entry => entry.endsWith(ITEM_EXT));
        return Promise.map(manifests, manifest =>
          fs.readFileAsync(path.join(manifestsLocation, manifest), { encoding: 'utf8' })
            .then(data => {
              try {
                const parsed = JSON.parse(data);
                const gamePath = getSafe(parsed, ['InstallLocation'], undefined);
                const name = getSafe(parsed, ['DisplayName'], undefined);
                const appid = getSafe(parsed, ['AppName'], undefined);

                return (!!gamePath && !!name && !!appid)
                  ? Promise.resolve({ gamePath, name, appid })
                  : Promise.resolve(undefined);
              } catch (err) {
                log('error', 'Cannot parse Epic Games manifest', err);
                return Promise.resolve(undefined);
              }
        })
        .catch(err => {
          log('error', 'Cannot read Epic Games manifest', err);
          return Promise.resolve(undefined);
        }));
      })
      .then((games: IEpicEntry[]) => games.filter(game => game !== undefined));
  }

  private get config(): Promise<{ data: any }> {
    if (this.mConfig === undefined) {
      const configPath = path.join(process.env['LOCALAPPDATA'], 'EpicGamesLauncher', 'Saved', 'Config', 'Windows', 'GameUserSettings.ini');
      let ini = new IniParser(new WinapiFormat);
      this.mConfig = ini.read(configPath)
        .catch({ code: 'ENOENT' }, err => {
          log('info', 'Epic Games Launcher not installed');
          return { data: {} };
        })
        .catch(err => {
          log('error', 'Failed to read epic games launcher config', err);
          return { data: {} };
        });
    }

    return this.mConfig;
  }
}

const instance: IEpicGamesLauncher = process.platform === 'win32' ?  new EpicGamesLauncher() : undefined;

export default instance;
