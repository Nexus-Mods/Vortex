// TODO: Remove Bluebird import - using native Promise;
import { log } from './log';
import { promiseMap } from './bluebird-migration-helpers.local';
import { isWindows, isMacOS, isLinux } from './platform';

import * as path from 'path';
const winapiT = isWindows() ? (isWindows() ? require('winapi-bindings') : undefined) : undefined;
import * as fs from './fs';
import { getSafe } from './storeHelper';
import getVortexPath from './getVortexPath';

import opn from './opn';

import { GameEntryNotFound, IExtensionApi, IGameStore, IGameStoreEntry } from '../types/api';
import { getCrossoverPaths, getVMwarePaths, getVirtualBoxPaths } from './macVirtualization';

// Use direct conditional require to avoid lazy loader issues in tests
const winapi: typeof winapiT = isWindows() ? require('winapi-bindings') : undefined;

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
  private mDataPath: Promise<string | undefined>;
  private mLauncherExecPath: string;
  private mCache: Promise<IGameStoreEntry[]>;

  constructor() {
    this.mDataPath = this.getEpicDataPath();
  }

  private getEpicDataPath(): Promise<string | undefined> {
    if (isWindows()) {
      try {
        // We find the launcher's dataPath
        const epicDataPath = winapi.RegGetValue('HKEY_LOCAL_MACHINE',
                                                'SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher',
                                                'AppDataPath');
        return Promise.resolve(epicDataPath.value as string);
      } catch (err) {
        log('info', 'Epic games launcher not found', { error: err.message });
        return Promise.resolve(undefined);
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

  public getPosixPath(name): Promise<string> {
    const posixPath = `com.epicgames.launcher://apps/${name}?action=launch&silent=true`;
    return Promise.resolve(posixPath);
  }

  public queryPath(): Promise<string> {
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
      // Find the manifest path and then parse manifests
      return this.getGameStorePath().then(storePath => {
        if (storePath) {
          // On Windows, manifests are in the Manifests subdirectory
          // On macOS/Linux, manifests are in the Epic Games Launcher data directory
          const manifestPath = isWindows() 
            ? path.join(path.dirname(storePath), 'Manifests')
            : path.join(storePath, 'Manifests');
          this.mCache = this.parseManifests();
        } else {
          this.mCache = Promise.resolve([]);
        }
        return this.mCache;
      });
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

  private getDataPath(): Promise<string | undefined> {
    if (isWindows()) {
      // On Windows, the data path is typically in %LOCALAPPDATA%\EpicGamesLauncher\Data
      return Promise.resolve(path.join(getVortexPath('localAppData'), 'EpicGamesLauncher', 'Data'));
    } else if (isMacOS()) {
      // On macOS, the data path is in ~/Library/Application Support/Epic
      return this.findMacOSEpicDataPath();
    } else {
      // On Linux, check for Heroic data path
      const heroicPath = path.join(getVortexPath('home'), '.config', 'heroic');
      return fs.statAsync(heroicPath)
        .then(() => heroicPath)
        .catch(() => {
          // Try flatpak path
          const flatpakPath = path.join(getVortexPath('home'), '.var', 'app', 'com.heroicgameslauncher.hgl', 'config', 'heroic');
          return fs.statAsync(flatpakPath)
            .then(() => flatpakPath)
            .catch(() => undefined);
        });
    }
  }

  public reloadGames(): Promise<void> {
    this.mCache = this.parseManifests();
    return Promise.resolve(undefined);
  }

  private parseManifests(): Promise<IGameStoreEntry[]> {
    return this.getDataPath().then(dataPath => {
      if (!dataPath) {
        return Promise.resolve([]);
      }

      // Manifests are in the Manifests subdirectory
      const manifestsPath = path.join(dataPath, 'Manifests');
      
      return fs.readdirAsync(manifestsPath)
        .then(files => {
          // Filter for .item files which are the manifest files
          const manifestFiles = files.filter(file => path.extname(file) === '.item');
          
          // Parse each manifest file
          return promiseMap(manifestFiles, file => {
            const manifestPath = path.join(manifestsPath, file);
            return fs.readFileAsync(manifestPath, { encoding: 'utf8' })
              .then(data => {
                const manifest = JSON.parse(data);
                if ((manifest.MainGameAppName !== undefined) && (manifest.AppName !== manifest.MainGameAppName)) {
                  // this is a DLC, not a game
                  return Promise.resolve(undefined);
                }
                if ((manifest.LaunchExecutable === undefined) || (manifest.InstallLocation === undefined)) {
                  return Promise.resolve(undefined);
                }

                const launchExecutable = manifest.LaunchExecutable.split(path.sep).join(path.posix.sep);
                const executables = [launchExecutable];
                if (manifest.OwnedAppNames !== undefined) {
                  // This is a "core" game, and we're looking at the "base" manifest.
                  //  The "OwnedAppNames" attribute contains the name of the actual
                  //  game manifest which we're going to need to resolve the executable
                  //  path.
                  const split = manifest.OwnedAppNames.split('/');
                  const ownedAppName = split[split.length - 1];
                  const ownedManifestPath = path.join(manifestsPath, `${ownedAppName}.item`);
                  return fs.readFileAsync(ownedManifestPath, { encoding: 'utf8' })
                    .then(ownedData => {
                      const ownedManifest = JSON.parse(ownedData);
                      const ownedExec = ownedManifest.LaunchExecutable?.split(path.sep).join(path.posix.sep);
                      if (!!ownedExec && (executables.indexOf(ownedExec) === -1)) {
                        executables.push(ownedExec);
                      }
                      return Promise.resolve({
                        appid: manifest.AppName,
                        name: manifest.DisplayName,
                        gamePath: manifest.InstallLocation,
                        gameStoreId: STORE_ID,
                        parameters: [{
                          appName: manifest.AppName,
                          user: manifest.InstalledBy,
                          executables,
                        }],
                      });
                    })
                    .catch(err => {
                      log('error', 'Cannot read Epic Games manifest', err);
                      return Promise.resolve(undefined);
                    });
                } else {
                  return Promise.resolve({
                    appid: manifest.AppName,
                    name: manifest.DisplayName,
                    gamePath: manifest.InstallLocation,
                    gameStoreId: STORE_ID,
                    parameters: [{
                      appName: manifest.AppName,
                      user: manifest.InstalledBy,
                      executables,
                    }],
                  });
                }
              })
              .catch(err => {
                log('error', 'Failed to parse Epic Games manifest', { file, error: err.message });
                return Promise.resolve(undefined);
              });
          });
        })
        .then(results => results.filter(result => result !== undefined) as IGameStoreEntry[])
        .catch(err => {
          log('error', 'Failed to read Epic Games manifests directory', err);
          return Promise.resolve([]);
        });
    });
  }

  public getGameStorePath(): Promise<string | undefined> {
    const getExecPath = (): Promise<string | undefined> => {
      if (isWindows()) {
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
      ? Promise.resolve(this.mLauncherExecPath)
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
}

const instance: IGameStore = new EpicGamesLauncher();

export default instance;