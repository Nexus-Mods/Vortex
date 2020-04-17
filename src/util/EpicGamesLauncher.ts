import { log } from './log';

import Promise from 'bluebird';
import * as path from 'path';
import * as winapi from 'winapi-bindings';
import * as fs from './fs';
import { getSafe } from './storeHelper';

import opn from './opn';

import { GameEntryNotFound, IExtensionApi, IGameStore, IGameStoreEntry } from '../types/api';

const ITEM_EXT = '.item';
const STORE_ID = 'epic';

/**
 * Epic Store launcher seems to be holding game information inside
 *  .item manifest files which are stored inside the launchers Data folder
 *  "(C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests" by default
 */
class EpicGamesLauncher implements IGameStore {
  public id: string;
  private mDataPath: Promise<string>;
  private mCache: Promise<IGameStoreEntry[]>;

  constructor() {
    this.id = STORE_ID;
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

  public findByAppId(appId: string): Promise<IGameStoreEntry> {
    return this.allGames()
      .then(entries => entries.find(entry => entry.appid === appId))
      .then(entry => entry === undefined
        ? Promise.reject(new GameEntryNotFound(appId, STORE_ID))
        : Promise.resolve(entry));
  }

  /**
   * Try to find the epic entry object using Epic's internal naming convention.
   *  e.g. "Flour" === "Untitled Goose Game" lol
   * @param name
   */
  public findByName(name: string): Promise<IGameStoreEntry> {
    const re = new RegExp(name);
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
                const gamePath = getSafe(parsed, ['InstallLocation'], undefined);
                const name = getSafe(parsed, ['DisplayName'], undefined);
                const appid = getSafe(parsed, ['AppName'], undefined);

                return (!!gamePath && !!name && !!appid)
                  ? Promise.resolve({ appid, name, gamePath, gameStoreId })
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
      .then((games) => games.filter(game => game !== undefined));
  }
}

const instance: IGameStore =
  process.platform === 'win32' ?  new EpicGamesLauncher() : undefined;

export default instance;
