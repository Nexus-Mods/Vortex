import { log } from './log';

import * as Promise from 'bluebird';
import * as path from 'path';
import * as winapi from 'winapi-bindings';
import * as fs from './fs';
import { getSafe } from './storeHelper';

import opn from './opn';

import { GameEntryNotFound, IGameStoreLauncher, ILauncherEntry } from '../types/api';

const ITEM_EXT = '.item';
const STORE_ID = 'epic';

/**
 * very limited functionality atm because so far the only source of information
 * I found was this ini file, and it contains no meta data about the games, not
 * even the installation path
 */
class EpicGamesLauncher implements IGameStoreLauncher {
  public id: string;
  private mDataPath: Promise<string>;
  private mCache: Promise<ILauncherEntry[]>;

  constructor() {
    this.id = STORE_ID;
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

  public launchGame(appId: string): Promise<void> {
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
    return this.findByName(name)
      .then(() => Promise.resolve(true))
      .catch(err => Promise.resolve(false));
  }

  public findByAppId(appId): Promise<ILauncherEntry> {
    return this.allGames()
      .then(entries => entries.find(entry => entry.appId === appId))
      .then(entry => entry === undefined
        ? Promise.reject(new GameEntryNotFound(appId, STORE_ID))
        : Promise.resolve(entry));
  }

  /**
   * Try to find the epic entry object using Epic's internal naming convention.
   *  e.g. "Flour" === "Untitled Goose Game" lol
   * @param name
   */
  public findByName(name): Promise<ILauncherEntry> {
    return this.allGames()
      .then(entries => entries.find(entry => entry.name === name))
      .then(entry => entry === undefined
        ? Promise.reject(new GameEntryNotFound(name, STORE_ID))
        : Promise.resolve(entry));
  }

  public allGames(): Promise<ILauncherEntry[]> {
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

  private parseManifests(): Promise<ILauncherEntry[]> {
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
                const gameStoreId = STORE_ID;
                const gamePath = getSafe(parsed, ['InstallLocation'], undefined);
                const name = getSafe(parsed, ['DisplayName'], undefined);
                const appId = getSafe(parsed, ['AppName'], undefined);

                return (!!gamePath && !!name && !!appId)
                  ? Promise.resolve({ appId, name, gamePath, gameStoreId })
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

const instance: IGameStoreLauncher =
  process.platform === 'win32' ?  new EpicGamesLauncher() : undefined;

export default instance;
