import { log } from './log';

import Promise from 'bluebird';
import * as path from 'path';
import * as winapiT from 'winapi-bindings';
import * as fs from './fs';
import { getSafe } from './storeHelper';

import opn from './opn';

import { GameEntryNotFound, IExtensionApi, IGameStore, IGameStoreEntry } from '../types/api';
import lazyRequire from './lazyRequire';

const winapi: typeof winapiT = lazyRequire(() => require('winapi-bindings'));

const ITEM_EXT = '.item';
const STORE_ID = 'epic';
const STORE_NAME = 'Epic Games Launcher';
const STORE_PRIORITY = 60;

/**
 * Epic Store launcher seems to be holding game information inside
 *  .item manifest files which are stored inside the launchers Data folder
 *  "(C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests" by default
 */
class EpicGamesLauncher implements IGameStore {
  public id: string = STORE_ID;
  public name: string = STORE_NAME;
  public priority: number = STORE_PRIORITY;
  private mDataPath: Promise<string>;
  private mLauncherExecPath: string;
  private mCache: Promise<IGameStoreEntry[]>;

  constructor() {
    if (process.platform === 'win32') {
      try {
        // We find the launcher's dataPath
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

  public launchGame(appInfo: any, api?: IExtensionApi): Promise<void> {
    const appId = ((typeof(appInfo) === 'object') && ('appId' in appInfo))
      ? appInfo.appId : appInfo.toString();

    return this.getPosixPath(appId)
      .then(posPath => opn(posPath).catch(err => Promise.resolve()));
  }

  public launchGameStore(api: IExtensionApi, parameters?: string[]): Promise<void> {
    const launchCommand = 'com.epicgames.launcher://start';
    return opn(launchCommand).catch(err => Promise.resolve());
  }

  public getPosixPath(name) {
    const posixPath = `com.epicgames.launcher://apps/${name}?action=launch&silent=true`;
    return Promise.resolve(posixPath);
  }

  public queryPath() {
    return this.mDataPath.then(dataPath => path.join(dataPath, this.executable()));
  }

  /**
   * test if a game is installed through the launcher.
   * Please keep in mind that epic seems to internally give third-party games animal names. Kinky.
   * @param name
   */
  public isGameInstalled(name: string): Promise<boolean> {
    return this.findByAppId(name)
      .catch(() => this.findByName(name))
      .then(() => Promise.resolve(true))
      .catch(() => Promise.resolve(false));
  }

  public findByAppId(appId: string | string[]): Promise<IGameStoreEntry> {
    const matcher = Array.isArray(appId)
      ? (entry: IGameStoreEntry) => (appId.includes(entry.appid))
      : (entry: IGameStoreEntry) => (appId === entry.appid);

    return this.allGames()
      .then(entries => entries.find(matcher))
      .then(entry => (entry === undefined)
        ? Promise.reject(
            new GameEntryNotFound(Array.isArray(appId) ? appId.join(', ') : appId, STORE_ID))
        : Promise.resolve(entry));
  }

  /**
   * Try to find the epic entry object using Epic's internal naming convention.
   *  e.g. "Flour" === "Untitled Goose Game" lol
   * @param name
   */
  public findByName(name: string): Promise<IGameStoreEntry> {
    const re = new RegExp('^' + name + '$');
    return this.allGames()
      .then(entries => entries.find(entry => re.test(entry.name)))
      .then(entry => (entry === undefined)
        ? Promise.reject(new GameEntryNotFound(name, STORE_ID))
        : Promise.resolve(entry));
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

  public getGameStorePath(): Promise<string> {
    const getExecPath = () => {
      try {
        const epicLauncher = winapi.RegGetValue('HKEY_LOCAL_MACHINE',
          'SOFTWARE\\Classes\\com.epicgames.launcher\\DefaultIcon',
          '(Default)');
        const val = epicLauncher.value;
        this.mLauncherExecPath = val.toString().split(',')[0];
        return Promise.resolve(this.mLauncherExecPath);
      } catch (err) {
        log('info', 'Epic games launcher not found', { error: err.message });
        return Promise.resolve(undefined);
      }
    };

    return (!!this.mLauncherExecPath)
      ? Promise.resolve(this.mLauncherExecPath)
      : getExecPath();
  }

  private executable() {
    // TODO: This probably won't work on *nix
    //  test and fix.
    return process.platform === 'win32'
      ? 'EpicGamesLauncher.exe'
      : 'EpicGamesLauncher';
  }

  private parseManifests(): Promise<IGameStoreEntry[]> {
    let manifestsLocation;
    return this.mDataPath
      .then(dataPath => {
        if (dataPath === undefined) {
          return Promise.resolve([]);
        }

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
                const gameStoreId = STORE_ID;
                const gameExec = getSafe(parsed, ['LaunchExecutable'], undefined);
                const gamePath = getSafe(parsed, ['InstallLocation'], undefined);
                const name = getSafe(parsed, ['DisplayName'], undefined);
                const appid = getSafe(parsed, ['AppName'], undefined);

                // Epic does not seem to clean old manifests. We need
                //  to stat the executable for each item to ensure that the
                //  game entry is actually valid.
                return (!!gamePath && !!name && !!appid && !!gameExec)
                  ? fs.statSilentAsync(path.join(gamePath, gameExec))
                      .then(() => Promise.resolve({ appid, name, gamePath, gameStoreId }))
                      .catch(() => Promise.resolve(undefined))
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
      .then((games) => games.filter(game => game !== undefined))
      .catch(err => {
        log('error', 'Failed to parse Epic Games manifests', err);
        return Promise.resolve([]);
      });
  }
}

const instance: IGameStore =
  process.platform === 'win32' ?  new EpicGamesLauncher() : undefined;

export default instance;
