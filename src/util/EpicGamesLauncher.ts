import Bluebird from 'bluebird';
import { log } from './log';
import { isWindows, isMacOS, isLinux } from './platform';

import * as path from 'path';
const winapiT = isWindows() ? (isWindows() ? require('winapi-bindings') : undefined) : undefined;
import * as fs from './fs';
import { getSafe } from './storeHelper';
import getVortexPath from './getVortexPath';

import opn from './opn';

import { GameEntryNotFound, IExtensionApi, IGameStore, IGameStoreEntry } from '../types/api';
import lazyRequire from './lazyRequire';
import { getCrossoverPaths, getVMwarePaths, getVirtualBoxPaths } from './macVirtualization';

// Removed Bluebird alias to avoid TS2529 error with top-level Promise in async modules
const winapi: typeof winapiT = lazyRequire(() => (isWindows() ? require('winapi-bindings') : undefined));

const ITEM_EXT = '.item';
const STORE_ID = 'epic';
const STORE_NAME = 'Epic Games Launcher';
const STORE_PRIORITY = 60;

/**
 * Epic Store launcher seems to be holding game information inside
 *  .item manifest files which are stored inside the launchers Data folder
 *  "(C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests" by default
 */
class EpicGamesLauncher implements IGameStore {
  public id: string = STORE_ID;
  public name: string = STORE_NAME;
  public priority: number = STORE_PRIORITY;
  private mDataPath: Bluebird<string | undefined>;
  private mLauncherExecPath: string;
  private mCache: Bluebird<IGameStoreEntry[]>;

  constructor() {
    this.mDataPath = this.getEpicDataPath();
  }

  private getEpicDataPath(): Bluebird<string | undefined> {
    if (isWindows()) {
      try {
        // We find the launcher's dataPath
        const epicDataPath = winapi.RegGetValue('HKEY_LOCAL_MACHINE',
                                                'SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher',
                                                'AppDataPath');
        return Bluebird.resolve(epicDataPath.value as string);
      } catch (err) {
        log('info', 'Epic games launcher not found', { error: err.message });
        return Bluebird.resolve(undefined);
      }
    } else if (isMacOS()) {
      // macOS: Epic Games Launcher stores data in ~/Library/Application Support/Epic
      const epicDataPath = path.join(getVortexPath('home'), 'Library', 'Application Support', 'Epic');
      return fs.statAsync(epicDataPath)
        .then(() => epicDataPath)
        .catch(() => this.findMacOSEpicDataPath())
        .catch(() => {
          log('info', 'Epic games launcher not found on macOS');
          return undefined;
        });
    } else {
      // Linux: Epic Games Launcher is not officially supported, but we can check for Heroic Games Launcher
      // Heroic stores Epic games data in ~/.config/heroic
      const heroicDataPath = path.join(getVortexPath('home'), '.config', 'heroic');
      return fs.statAsync(heroicDataPath)
        .then(() => heroicDataPath)
        .catch(() => {
          log('info', 'Epic games launcher (via Heroic) not found on Linux');
          return undefined;
        });
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

  public getPosixPath(name): Bluebird<string> {
    const posixPath = `com.epicgames.launcher://apps/${name}?action=launch&silent=true`;
    return Bluebird.resolve(posixPath);
  }

  public queryPath(): Bluebird<string> {
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

  private async findMacOSEpicDataPath(): Promise<string | undefined> {
    // First check the standard macOS Epic path
    const standardPath = path.join(getVortexPath('home'), 'Library', 'Application Support', 'Epic');
    try {
      if (await fs.statAsync(standardPath)) {
        return standardPath;
      }
    } catch (err) {
      // Standard path not found, continue searching
    }

    // Check for Epic Games Launcher in Crossover bottles
    try {
      const crossoverPaths = await getCrossoverPaths();
      for (const bottlePath of crossoverPaths) {
        // Epic Games Launcher is typically installed in drive_c/Program Files (x86)/Epic Games/Launcher
        const crossoverEpicPath = path.join(bottlePath, 'drive_c', 'Program Files (x86)', 'Epic Games', 'Launcher');
        try {
          if (await fs.statAsync(crossoverEpicPath)) {
            // The data path would be in the Public folder within the bottle
            return path.join(bottlePath, 'users', 'Public', 'Epic Games');
          }
        } catch (err) {
          // Continue to next path
        }
      }
    } catch (err) {
      log('debug', 'Failed to check Crossover Epic paths', { error: err.message });
    }

    // Check for Epic Games Launcher in VMware VMs
    try {
      const vmwarePaths = await getVMwarePaths();
      for (const vmPath of vmwarePaths) {
        // Epic Games Launcher might be installed in drive_c/Program Files (x86)/Epic Games/Launcher in VMware VMs
        const vmwareEpicPath = path.join(vmPath, 'drive_c', 'Program Files (x86)', 'Epic Games', 'Launcher');
        try {
          if (await fs.statAsync(vmwareEpicPath)) {
            // The data path would be in the Public folder within the VM
            return path.join(vmPath, 'users', 'Public', 'Epic Games');
          }
        } catch (err) {
          // Continue to next path
        }
      }
    } catch (err) {
      log('debug', 'Failed to check VMware Epic paths', { error: err.message });
    }

    // Check for Epic Games Launcher in VirtualBox VMs
    try {
      const virtualboxPaths = await getVirtualBoxPaths();
      for (const vmPath of virtualboxPaths) {
        // Epic Games Launcher might be installed in drive_c/Program Files (x86)/Epic Games/Launcher in VirtualBox VMs
        const virtualboxEpicPath = path.join(vmPath, 'drive_c', 'Program Files (x86)', 'Epic Games', 'Launcher');
        try {
          if (await fs.statAsync(virtualboxEpicPath)) {
            // The data path would be in the Public folder within the VM
            return path.join(vmPath, 'users', 'Public', 'Epic Games');
          }
        } catch (err) {
          // Continue to next path
        }
      }
    } catch (err) {
      log('debug', 'Failed to check VirtualBox Epic paths', { error: err.message });
    }

    // Return undefined if Epic Games Launcher is not found
    return undefined;
  }

  public reloadGames(): Bluebird<void> {
    this.mCache = this.parseManifests();
    return Bluebird.resolve();
  }

  public getGameStorePath(): Bluebird<string | undefined> {
    const getExecPath = (): Bluebird<string | undefined> => {
      if (isWindows()) {
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
      } else if (isMacOS()) {
         // macOS: Epic Games Launcher is typically in /Applications
        const epicAppPath = '/Applications/Epic Games Launcher.app';
        return fs.statAsync(epicAppPath)
          .then(() => {
            this.mLauncherExecPath = epicAppPath;
            return epicAppPath;
          })
          .catch(async () => {
             // On macOS, also check Crossover and then VMware/VirtualBox
            try {
              const crossoverPaths = await getCrossoverPaths();
              for (const bottlePath of crossoverPaths) {
                const crossoverEpicPath = path.join(bottlePath, 'drive_c', 'Program Files (x86)', 'Epic Games', 'Launcher');
                try {
                  if (await fs.statAsync(crossoverEpicPath)) {
                    this.mLauncherExecPath = crossoverEpicPath;
                    return crossoverEpicPath;
                  }
                } catch (err) {
                   // Continue checking other paths
                }
              }
            } catch (err) {
               // No Crossover paths found
            }

             // Check VMware paths
            try {
              const vmwarePaths = await getVMwarePaths();
              for (const vmPath of vmwarePaths) {
                const vmEpicPath = path.join(vmPath, 'Program Files (x86)', 'Epic Games', 'Launcher');
                try {
                  if (await fs.statAsync(vmEpicPath)) {
                    this.mLauncherExecPath = vmEpicPath;
                    return vmEpicPath;
                  }
                } catch (err) {
                   // Continue checking other paths
                }
              }
            } catch (err) {
               // No VMware paths found
            }

             // Check VirtualBox paths
            try {
              const vboxPaths = await getVirtualBoxPaths();
              for (const vboxPath of vboxPaths) {
                const vboxEpicPath = path.join(vboxPath, 'Program Files (x86)', 'Epic Games', 'Launcher');
                try {
                  if (await fs.statAsync(vboxEpicPath)) {
                    this.mLauncherExecPath = vboxEpicPath;
                    return vboxEpicPath;
                  }
                } catch (err) {
                   // Continue checking other paths
                }
              }
            } catch (err) {
               // No VirtualBox paths found
            }

             // If not found in virtualization paths, return undefined
            return undefined;
          });
      } else {
         // Linux: Try Heroic Games Launcher
        const heroicPath = '/usr/bin/heroic';
        return fs.statAsync(heroicPath)
          .then(() => {
            this.mLauncherExecPath = heroicPath;
            return heroicPath;
          })
          .catch(() => {
             // Try flatpak installation
            const flatpakPath = '/var/lib/flatpak/exports/bin/com.heroicgameslauncher.hgl';
            return fs.statAsync(flatpakPath)
              .then(() => {
                this.mLauncherExecPath = flatpakPath;
                return flatpakPath;
              })
              .catch(() => {
                log('info', 'Heroic games launcher not found');
                return undefined;
              });
          });
      }
    };

    return (!!this.mLauncherExecPath)
      ? Bluebird.resolve(this.mLauncherExecPath)
      : getExecPath();
  }

  private executable() {
    if (isWindows()) {
      return 'EpicGamesLauncher.exe';
    } else if (isMacOS()) {
      return 'Epic Games Launcher.app';
    } else {
      // Linux: Use Heroic Games Launcher as alternative
      return 'heroic';
    }
  }

  private parseManifests(): Bluebird<IGameStoreEntry[]> {
    let manifestsLocation;
    return this.mDataPath
      .then(dataPath => {
        if (dataPath === undefined) {
          return Bluebird.resolve([]);
        }

        if (isLinux()) {
          // For Heroic Games Launcher on Linux, check for Epic games in the gog_store/installed.json
          manifestsLocation = path.join(dataPath, 'store_cache', 'legendary_library.json');
          return this.parseHeroicManifests(manifestsLocation);
        } else {
          // Windows and macOS use the standard Epic manifests
          manifestsLocation = path.join(dataPath, 'Manifests');
          return fs.readdirAsync(manifestsLocation);
        }
      })
      .catch({ code: 'ENOENT' }, err => {
        log('info', 'Epic launcher manifests could not be found', err.code);
        return Bluebird.resolve([]);
      })
      .then(entries => {
        if (isLinux()) {
          // Already parsed in parseHeroicManifests
          return entries;
        }
        
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
      .then((games) => games.filter(game => game !== undefined))
      .catch(err => {
        log('error', 'Failed to parse Epic Games manifests', err);
        return Bluebird.resolve([]);
      });
  }

  private parseHeroicManifests(manifestPath: string): Bluebird<IGameStoreEntry[]> {
    return fs.readFileAsync(manifestPath, { encoding: 'utf8' })
      .then(data => {
        try {
          const parsed = JSON.parse(data);
          const games: IGameStoreEntry[] = [];
          
          // Heroic stores Epic games in a different format
          if (Array.isArray(parsed)) {
            for (const game of parsed) {
              if (game.app_name && game.title && game.install_path) {
                games.push({
                  appid: game.app_name,
                  name: game.title,
                  gamePath: game.install_path,
                  gameStoreId: STORE_ID
                });
              }
            }
          }
          
          return Promise.resolve(games);
        } catch (err) {
          log('error', 'Cannot parse Heroic Games manifest', err);
          return Promise.resolve([]);
        }
      })
      .catch(err => {
        log('info', 'Heroic Games manifest not found', err);
        return Promise.resolve([]);
      });
  }
}

const instance: IGameStore = new EpicGamesLauncher();

export default instance;