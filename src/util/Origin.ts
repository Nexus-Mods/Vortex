import { log } from './log';

import Bluebird from 'bluebird';
const Promise = Bluebird;
import * as path from 'path';
const winapiT = isWindows() ? (isWindows() ? require('winapi-bindings') : undefined) : undefined;
import * as fs from './fs';
import { getSafe } from './storeHelper';
import getVortexPath from './getVortexPath';

import opn from './opn';

import { GameEntryNotFound, IExtensionApi, IGameStore, IGameStoreEntry } from '../types/api';
import lazyRequire from './lazyRequire';
import { isWindows, isMacOS, isLinux, getWineDriveCPath, platformSwitch } from './platform';
import { getCrossoverPaths } from './macVirtualization';

const winapi: typeof winapiT = lazyRequire(() => (isWindows() ? require('winapi-bindings') : undefined));

const STORE_ID = 'origin';

class Origin implements IGameStore {
  public id: string = STORE_ID;
  public name: string = 'Origin/EA App';
  public priority: number = 2;
  private mDataPath: Promise<string | undefined>;
  private mLauncherExecPath: string;
  private mCache: Promise<IGameStoreEntry[]>;

  constructor() {
    this.mDataPath = this.getOriginDataPath();
    this.mCache = this.parseManifests();
  }

  private getOriginDataPath(): Promise<string | undefined> {
    return platformSwitch<Promise<string | undefined>>({
      win32: () => {
        // Windows: Check both Origin and EA App locations
        const originPath = path.join(getVortexPath('localAppData'), 'Origin');
        const eaAppPath = path.join(getVortexPath('localAppData'), 'Electronic Arts', 'EA Desktop');
        
        return fs.statAsync(eaAppPath)
          .then(() => eaAppPath)
          .catch(() => fs.statAsync(originPath)
            .then(() => originPath)
            .catch(() => {
              log('info', 'Origin/EA App not found on Windows');
              return undefined;
            })
          );
      },
      darwin: () => {
        // macOS: Check for Origin/EA App in virtualized environments
        return this.findMacOSOriginDataPath();
      },
      linux: () => {
        // Linux: Origin/EA App is not natively available, but we can check for Wine installations
        const wineDriveC = getWineDriveCPath();
        const wineOriginPath = path.join(wineDriveC, 'Program Files (x86)', 'Origin');
        const wineEAAppPath = path.join(wineDriveC, 'Program Files', 'Electronic Arts', 'EA Desktop');
        
        return fs.statAsync(wineEAAppPath)
          .then(() => wineEAAppPath)
          .catch(() => fs.statAsync(wineOriginPath)
            .then(() => wineOriginPath)
            .catch(() => {
              log('info', 'Origin/EA App not found on Linux');
              return undefined;
            })
          );
      }
    });
  }

  private async findMacOSOriginDataPath(): Promise<string | undefined> {
    // Check for Origin/EA App in Crossover bottles
    try {
      const crossoverPaths = await getCrossoverPaths();
      for (const bottlePath of crossoverPaths) {
        // Origin is typically installed in drive_c/Program Files (x86)/Origin
        const crossoverOriginPath = path.join(bottlePath, 'drive_c', 'Program Files (x86)', 'Origin');
        // EA App is typically installed in drive_c/Program Files/Electronic Arts/EA Desktop
        const crossoverEAAppPath = path.join(bottlePath, 'drive_c', 'Program Files', 'Electronic Arts', 'EA Desktop');
        
        try {
          if (await fs.statAsync(crossoverEAAppPath)) {
            return crossoverEAAppPath;
          }
          if (await fs.statAsync(crossoverOriginPath)) {
            return crossoverOriginPath;
          }
        } catch (err) {
          // Continue to next path
        }
      }
    } catch (err) {
      log('debug', 'Failed to check Crossover Origin/EA App paths', { error: err.message });
    }

    log('info', 'Origin/EA App not found in virtualized environments on macOS');
    return undefined;
  }

  public allGames(): Promise<IGameStoreEntry[]> {
    if (!this.mCache) {
      return this.reloadGames().then(() => this.mCache);
    }
    return this.mCache;
  }

  public reloadGames(): Promise<void> {
    this.mCache = this.parseManifests();
    return Promise.resolve();
  }

  public findByAppId(appId: string | string[]): Promise<IGameStoreEntry> {
    const id = Array.isArray(appId) ? appId[0] : appId;
    return this.allGames()
      .then(games => {
        const game = games.find(iter => iter.appid === id);
        if (game === undefined) {
          return Promise.reject(new GameEntryNotFound(Array.isArray(appId) ? appId.join(',') : appId, STORE_ID));
        }
        return Promise.resolve(game);
      });
  }

  public findByName(namePattern: string): Promise<IGameStoreEntry> {
    return this.allGames()
      .then(entries => {
        const re = new RegExp(namePattern);
        const entry = entries.find(iter => re.test(iter.name));
        if (entry === undefined) {
          return Promise.reject(new GameEntryNotFound(namePattern, STORE_ID));
        }
        return Promise.resolve(entry);
      });
  }

  public getGameStorePath(): Promise<string> {
    if (this.mLauncherExecPath !== undefined) {
      return Promise.resolve(this.mLauncherExecPath);
    }

    return platformSwitch({
      win32: () => {
        // Check for EA App first, then Origin
        const eaAppPath = path.join(getVortexPath('localAppData'), '..', 'Local', 'Programs', 'Electronic Arts', 'EA Desktop', 'EA Desktop', 'EADesktop.exe');
        const originPath = path.join(getVortexPath('localAppData'), '..', 'Local', 'Programs', 'Origin', 'Origin.exe');
        
        return fs.statAsync(eaAppPath)
          .then(() => {
            this.mLauncherExecPath = eaAppPath;
            return eaAppPath;
          })
          .catch(() => fs.statAsync(originPath)
            .then(() => {
              this.mLauncherExecPath = originPath;
              return originPath;
            })
            .catch(() => {
              log('info', 'Origin/EA App not found in default location');
              return Promise.reject(new Error('Origin/EA App not found'));
            })
          );
      },
      darwin: () => {
        // macOS: Check for Origin/EA App in virtualized environments
        return this.findMacOSOriginPath();
      },
      linux: () => {
        // Linux: Origin/EA App is not natively available, but we can check for Wine installations
        const wineDriveC = getWineDriveCPath();
        const wineEAAppPath = path.join(wineDriveC, 'Program Files', 'Electronic Arts', 'EA Desktop', 'EA Desktop', 'EADesktop.exe');
        const wineOriginPath = path.join(wineDriveC, 'Program Files (x86)', 'Origin', 'Origin.exe');
        
        return fs.statAsync(wineEAAppPath)
          .then(() => {
            this.mLauncherExecPath = wineEAAppPath;
            return wineEAAppPath;
          })
          .catch(() => fs.statAsync(wineOriginPath)
            .then(() => {
              this.mLauncherExecPath = wineOriginPath;
              return wineOriginPath;
            })
            .catch(() => {
              log('info', 'Origin/EA App not found on Linux');
              return Promise.reject(new Error('Origin/EA App not found on Linux'));
            })
          );
      }
    });
  }

  private async findMacOSOriginPath(): Promise<string> {
    // Check for Origin/EA App in Crossover bottles
    try {
      const crossoverPaths = await getCrossoverPaths();
      for (const bottlePath of crossoverPaths) {
        // EA App is typically installed in drive_c/Program Files/Electronic Arts/EA Desktop
        const crossoverEAAppPath = path.join(bottlePath, 'drive_c', 'Program Files', 'Electronic Arts', 'EA Desktop', 'EA Desktop', 'EADesktop.exe');
        // Origin is typically installed in drive_c/Program Files (x86)/Origin
        const crossoverOriginPath = path.join(bottlePath, 'drive_c', 'Program Files (x86)', 'Origin', 'Origin.exe');
        
        try {
          if (await fs.statAsync(crossoverEAAppPath)) {
            this.mLauncherExecPath = crossoverEAAppPath;
            return crossoverEAAppPath;
          }
          if (await fs.statAsync(crossoverOriginPath)) {
            this.mLauncherExecPath = crossoverOriginPath;
            return crossoverOriginPath;
          }
        } catch (err) {
          // Continue to next path
        }
      }
    } catch (err) {
      log('debug', 'Failed to check Crossover Origin/EA App paths', { error: err.message });
    }

    return Promise.reject(new Error('Origin/EA App not found in virtualized environments on macOS'));
  }

  public launchGameStore(api?: IExtensionApi): Promise<void> {
    return this.getGameStorePath()
      .then(storePath => {
        return opn(storePath, false).catch(err => Promise.resolve());
      });
  }

  public launchGame(appId: string, api?: IExtensionApi): Promise<void> {
    return this.getGameStorePath()
      .then(storePath => {
        // Origin/EA App launch command format: origin://launchgame/<appId>
        const launchUrl = `origin://launchgame/${appId}`;
        return opn(launchUrl, false).catch(err => Promise.resolve());
      });
  }

  private executable() {
    return this.getGameStorePath();
  }

  private parseManifests(): Promise<IGameStoreEntry[]> {
    return this.mDataPath
      .then((dataPath: string | undefined) => {
        if (!dataPath) {
          return Promise.resolve([]);
        }
        
        // Origin/EA App stores game information in different locations
        // This is a simplified implementation - in reality, you'd need to parse
        // the actual manifest files or registry entries
        // For now, return empty array as the manifest structure is complex
        return Promise.resolve([]);
      })
      .catch(err => {
        log('warn', 'Failed to parse Origin/EA App manifests', err);
        return Promise.resolve([]);
      });
  }
}

const instance: IGameStore = new Origin();

export default instance;