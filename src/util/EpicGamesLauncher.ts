import { log } from './log';

import Bluebird from 'bluebird';
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

/**
 * Epic Store launcher seems to be holding game information inside
 *  .item manifest files which are stored inside the launchers Data folder
 *  "(C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests" by default
 */
class EpicGamesLauncher implements IGameStore {
  public id: string;
  private mDataPath: Bluebird<string>;
  private mLauncherExecPath: string;
  private mCache: Bluebird<IGameStoreEntry[]>;

  constructor() {
    this.id = STORE_ID;
    if (process.platform === 'win32') {
      try {
        // We find the launcher's dataPath
        const epicDataPath = winapi.RegGetValue('HKEY_LOCAL_MACHINE',
          'SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher',
          'AppDataPath');
        this.mDataPath = Bluebird.resolve(epicDataPath.value as string);
      } catch (err) {
        log('info', 'Epic games launcher not found', { error: err.message });
        this.mDataPath = Bluebird.resolve(undefined);
      }
    } else {
      // TODO: Is epic launcher even available on non-windows platforms?
      this.mDataPath = Bluebird.resolve(undefined);
    }
  }

  public launchGame(appInfo: any, api?: IExtensionApi): Bluebird<void> {
    const appId = ((typeof(appInfo) === 'object') && ('appId' in appInfo))
      ? appInfo.appId : appInfo.toString();

    return this.getPosixPath(appId)
      .then(posPath => opn(posPath).catch(err => Bluebird.resolve()));
  }

  public launchGameStore(api: IExtensionApi, parameters?: string[]): Bluebird<void> {
    const launchCommand = 'com.epicgames.launcher://start';
    return opn(launchCommand).catch(err => Bluebird.resolve());
  }

  public getPosixPath(name) {
    const posixPath = `com.epicgames.launcher://apps/${name}?action=launch&silent=true`;
    return Bluebird.resolve(posixPath);
  }

  public queryPath() {
    return this.mDataPath.then(dataPath => path.join(dataPath, this.executable()));
  }

  /**
   * test if a game is installed through the launcher.
   * Please keep in mind that epic seems to internally give third-party games animal names. Kinky.
   * @param name
   */
  public isGameInstalled(name: string): Bluebird<boolean> {
    return this.findByAppId(name)
      .catch(() => this.findByName(name))
      .then(() => Bluebird.resolve(true))
      .catch(() => Bluebird.resolve(false));
  }

  public findByAppId(appId: string | string[]): Bluebird<IGameStoreEntry> {
    const matcher = Array.isArray(appId)
      ? (entry: IGameStoreEntry) => (appId.includes(entry.appid))
      : (entry: IGameStoreEntry) => (appId === entry.appid);

    return this.allGames()
      .then(entries => entries.find(matcher))
      .then(entry => (entry === undefined)
        ? Bluebird.reject(
            new GameEntryNotFound(Array.isArray(appId) ? appId.join(', ') : appId, STORE_ID))
        : Bluebird.resolve(entry));
  }

  /**
   * Try to find the epic entry object using Epic's internal naming convention.
   *  e.g. "Flour" === "Untitled Goose Game" lol
   * @param name
   */
  public findByName(name: string): Bluebird<IGameStoreEntry> {
    const re = new RegExp('^' + name + '$');
    return this.allGames()
      .then(entries => entries.find(entry => re.test(entry.name)))
      .then(entry => (entry === undefined)
        ? Bluebird.reject(new GameEntryNotFound(name, STORE_ID))
        : Bluebird.resolve(entry));
  }

  public allGames(): Bluebird<IGameStoreEntry[]> {
    if (!this.mCache) {
      this.mCache = this.parseManifests();
    }
    return this.mCache;
  }

  public reloadGames(): Bluebird<void> {
    return new Bluebird((resolve) => {
      this.mCache = this.parseManifests();
      return resolve();
    });
  }

  public getGameStorePath(): Bluebird<string> {
    const getExecPath = () => {
      try {
        const epicLauncher = winapi.RegGetValue('HKEY_LOCAL_MACHINE',
          'SOFTWARE\\Classes\\com.epicgames.launcher\\DefaultIcon',
          '(Default)');
        const val = epicLauncher.value;
        this.mLauncherExecPath = val.toString().split(',')[0];
        return Bluebird.resolve(this.mLauncherExecPath);
      } catch (err) {
        log('info', 'Epic games launcher not found', { error: err.message });
        return Bluebird.resolve(undefined);
      }
    };

    return (!!this.mLauncherExecPath)
      ? Bluebird.resolve(this.mLauncherExecPath)
      : getExecPath();
  }

  private executable() {
    // TODO: This probably won't work on *nix
    //  test and fix.
    return process.platform === 'win32'
      ? 'EpicGamesLauncher.exe'
      : 'EpicGamesLauncher';
  }

  private parseManifests(): Bluebird<IGameStoreEntry[]> {
    let manifestsLocation;
    return this.mDataPath
      .then(dataPath => {
        if (dataPath === undefined) {
          return Bluebird.resolve([]);
        }

        manifestsLocation = path.join(dataPath, 'Manifests');
        return fs.readdirAsync(manifestsLocation);
      })
      .catch({ code: 'ENOENT' }, err => {
        log('info', 'Epic launcher manifests could not be found', err.code);
        return Bluebird.resolve([]);
      })
      .then(entries => {
        const manifests = entries.filter(entry => entry.endsWith(ITEM_EXT));
        return Bluebird.map(manifests, manifest =>
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
                      .then(() => Bluebird.resolve({ appid, name, gamePath, gameStoreId }))
                      .catch(() => Bluebird.resolve(undefined))
                  : Bluebird.resolve(undefined);
              } catch (err) {
                log('error', 'Cannot parse Epic Games manifest', err);
                return Bluebird.resolve(undefined);
              }
        })
        .catch(err => {
          log('error', 'Cannot read Epic Games manifest', err);
          return Bluebird.resolve(undefined);
        }));
      })
      .then((games) => games.filter(game => game !== undefined));
  }
}

const instance: IGameStore =
  process.platform === 'win32' ?  new EpicGamesLauncher() : undefined;

export default instance;
