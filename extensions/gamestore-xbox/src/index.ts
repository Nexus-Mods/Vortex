/* eslint-disable */
import { spawn } from 'child_process';
import * as path from 'path';
import { fs, log, types, util } from 'vortex-api';
import * as winapi from 'winapi-bindings';
import { parseStringPromise } from 'xml2js';
import { findInstalledGames } from './util';
import { GamePathMap, IXboxEntry } from './types';
import { IGNORABLE, MUTABLE_LOCATION_PATH, REPOSITORY_PATH,
  REPOSITORY_PATH2, XBOXAPP_NAMES, RESOURCES_PATH, STORE_ID,
  STORE_NAME, STORE_PRIORITY } from './common';

/**
 * base class to interact with local xbox game store.
 * @class XboxLauncher
 */
// Computer\HKEY_CURRENT_USER\Software\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Compatibility Assistant\Store
function gameStoreDetection(silent?: boolean): boolean {
  let isXboxInstalled = false;
  const logFunc = silent ? () => null : log;
  if (process.platform === 'win32') {
    // No Windows, no xbox launcher!
    try {
      winapi.WithRegOpen('HKEY_CLASSES_ROOT', REPOSITORY_PATH, hkey => {
        const keys = winapi.RegEnumKeys(hkey).map(key => key.key.toLowerCase());
        isXboxInstalled = keys.find(key => XBOXAPP_NAMES.findIndex(name => key.startsWith(name)) !== -1) !== undefined;
        if (!isXboxInstalled) {
          logFunc('info', 'xbox launcher not installed: microsoft.xboxapp missing');
        }
      });
    } catch (err) {
      logFunc('info', 'xbox launcher not found', { error: err.code });
      isXboxInstalled = false;
    }
  } else {
    logFunc('info', 'xbox launcher not found', { error: 'only available on Windows systems' });
    isXboxInstalled = false;
  }

  return isXboxInstalled;
}

class XboxLauncher implements types.IGameStore {
  public id: string = STORE_ID;
  public name: string = STORE_NAME;
  public priority: number = STORE_PRIORITY;
  private isXboxInstalled: boolean;
  private mCache: Promise<IXboxEntry[]>;
  private mApi: types.IExtensionApi;

  constructor(api?: types.IExtensionApi) {
    this.isXboxInstalled = gameStoreDetection();
    this.mApi = api;
  }

  // To successfully launch an Xbox game through the app we need to assemble
  //  the execution command which consists of:
  //  - Explorer shell command (this will not change)
  //  - Identity
  //  - PunlisherId
  //  - The game/app "executable"
  // e.g. explorer.exe shell:appsFolder\\SystemEraSoftworks.29415440E1269_ftk5pbg2rayv2!ASTRONEER
  public launchGame(appInfo: any, api?: types.IExtensionApi): Promise<void> {
    if (!appInfo) {
      return Promise.reject(new util.ArgumentInvalid('appInfo is undefined/null'));
    }

    const isCustomExecObject = () => {
      return ((typeof(appInfo) === 'object') && ('appId' in appInfo));
    };

    const findExecName = (entry: IXboxEntry) => {
      let appExecName: string;
      if (isCustomExecObject()) {
        const nameArg = appInfo.parameters.find(arg => 'appExecName' in arg);
        appExecName = (!!nameArg)
          ? nameArg.appExecName
          : entry.executionName;
      } else {
        appExecName = entry.executionName;
      }

      return appExecName;
    };

    const appId = isCustomExecObject() ? appInfo.appId : appInfo.toString();
    return this.findByAppId(appId).then(entry => {
      const launchCommand = `shell:appsFolder\\${(entry as any).appid}_${entry.publisherId}!${findExecName(entry)}`;
      log('debug', 'launching game through xbox store', launchCommand);
      return this.oneShotLaunch(launchCommand);
    });
  }

  public findByName(appName: string): Promise<IXboxEntry> {
    const re = new RegExp('^' + appName + '$');
    return this.allGames()
      .then(entries => {
        const gameEntry = entries.find(entry => re.test((entry as any).name));
        return !!gameEntry
          ? Promise.resolve(gameEntry)
          : Promise.reject(new types.GameEntryNotFound(appName, STORE_ID));
      });
  }

  /**
   * find the first game with the specified appid or one of the specified appids
   */
  public findByAppId(appId: string | string[]): Promise<IXboxEntry> {
    const matcher = Array.isArray(appId)
      ? (entry) => (appId.includes(entry.appid))
      : (entry) => (appId === entry.appid);

    return this.allGames()
      .then(entries => {
        const gameEntry = entries.find(matcher);
        if (gameEntry === undefined) {
          return Promise.reject(
            new types.GameEntryNotFound(Array.isArray(appId) ? appId.join(', ') : appId, STORE_ID));
        } else {
          return Promise.resolve(gameEntry);
        }
      });
  }

  public allGames(): Promise<IXboxEntry[]> {
    if (!gameStoreDetection()) {
      return Promise.resolve([]);
    }

    if (!this.mCache) {
      this.mCache = this.getGameEntries();
    }
    return this.mCache;
  }

  public reloadGames(): Promise<void> {
    if (!this.isXboxInstalled) {
      return Promise.resolve();
    }

    return new Promise(async (resolve) => {
      this.mCache = this.getGameEntries();
      return resolve();
    });
  }

  public getGameStorePath(): Promise<string> {
    // Xbox game store doesn't have a path we can reliably
    //  query, which is why we're just returning undefined here.
    return Promise.resolve(undefined);
  }

  public isGameStoreInstalled(): Promise<boolean> {
    // Since we return undefined in getGameStorePath, we need
    //  to define our own way of telling the game store helper
    //  if the game store is installed.
    return Promise.resolve(this.isXboxInstalled);
  }

  public launchGameStore(api: types.IExtensionApi, parameters?: string[]): Promise<void> {
    const execName = !!parameters
      ? parameters.join('') : 'Microsoft.Xbox.App';
    const launchCommand = `shell:appsFolder\\Microsoft.GamingApp_8wekyb3d8bbwe!${execName}`;
    return this.oneShotLaunch(launchCommand);
  }

  public identifyGame(gamePath: string,
                      fallback: (gamePath: string) => PromiseLike<boolean>)
                      : Promise<boolean> {
    if (gamePath.toLowerCase().split(path.sep).includes('modifiablewindowsapps')) {
      return Promise.resolve(true);
    } else {
      return Promise.resolve(fallback(gamePath));
    }
  }

  private getFirstKeyName(rootKey: winapi.REGISTRY_HIVE, keyPath: string): string {
    const keyNames = this.getKeyNames(rootKey, keyPath);
    return keyNames.length > 0 ? keyNames[0] : undefined;
  }

  // Please note that the filterList is aimed at EXCLUDING/IGNORING the provided strings.
  private getKeyNames(rootKey: winapi.REGISTRY_HIVE, keyPath: string, filterList?: string[]): string[] {
    let keyNames: string[] = [];
    try {
      winapi.WithRegOpen(rootKey, keyPath, hkey => {
        const names = winapi.RegEnumKeys(hkey);
        keyNames = ((!!filterList)
          ? names.filter(key => filterList.find(ign => key.key.toLowerCase().startsWith(ign)) === undefined)
          : names).map(key => key.key);
      });
    } catch (err) {
      // It's perfectly valid for a keypath not to exist. We're
      //  only concerned with keypaths that exist and a different error
      //  is raised.
      if (err.code !== 'ENOENT') {
        log('error', 'unable to retrieve key names', keyPath);
      }
    }

    return keyNames;
  }

  private oneShotLaunch(launchCommand: string) {
    // Given its unconventional launch command, util.opn cannot be used
    //  here as it will report ENOENT. We spawn explorer.exe with the launch command separately.
    spawn('explorer.exe', [launchCommand], { shell: true });
    return Promise.resolve();
  }

  private getAppManifestData(mutablePath: string) {
    const appManifestFilePath = path.join(mutablePath, 'appxmanifest.xml');
    return fs.readFileAsync(appManifestFilePath, { encoding: 'utf8' })
      .then((data) => parseStringPromise(data))
      .then((parsed) => Promise.resolve(parsed))
      .catch(err => Promise.resolve(undefined));
  }

  private mutableLinkMap(): { [link: string]: string } {
    const result: { [link: string]: string } = {};
    try {
      winapi.WithRegOpen('HKEY_LOCAL_MACHINE', MUTABLE_LOCATION_PATH, firsthkey => {
        const keys: string[] = winapi.RegEnumKeys(firsthkey).map(key => key.key);
        for (const key of keys) {
          const hivePath = path.join(MUTABLE_LOCATION_PATH, key);
          winapi.WithRegOpen('HKEY_LOCAL_MACHINE', hivePath, secondhkey => {
            // We only care for string values.
            const values: string[] = winapi.RegEnumValues(secondhkey)
              .filter(val => val.type === 'REG_SZ')
              .map(val => val.key);

            if (values.includes('MutableLink') && values.includes('MutableLocation')) {
              try {
                // So we confirmed that we have the mutable values in, but there have been occurences
                //  where we couldn't retrieve them which is odd. https://github.com/Nexus-Mods/Vortex/issues/8824
                const link = winapi.RegGetValue('HKEY_LOCAL_MACHINE', hivePath, 'MutableLink').value as string;
                result[link] = hivePath;
              } catch (err) {
                return;
              }
            }
          });
        }
      });
      return result;
    } catch (err) {
      log('debug', 'failed to resolve mutable location', err);
      return {};
    }
  }

  private resolveMutableLocation(packagePath: string, linkMap: { [link: string]: string }): string {
    let mutableLocation: string;
    try {
      if (linkMap[packagePath] !== undefined) {
        mutableLocation = winapi.RegGetValue('HKEY_LOCAL_MACHINE', linkMap[packagePath], 'MutableLocation').value as string;
      }
      return mutableLocation;
    } catch (err) {
      log('debug', 'failed to resolve mutable location', err);
      return undefined;
    }
  }

  private resolveRef(packageId: string, displayName: string): string {
    // Lets try and resolve this nightmare.
    const cachePath: string = RESOURCES_PATH.replace('{{PACKAGE_ID}}', packageId);
    const firstKey: string = this.getFirstKeyName('HKEY_CLASSES_ROOT', cachePath);
    if (!firstKey) {
      return undefined;
    }
    const hivesPath: string = path.join(cachePath, firstKey);
    const hives: string[] = this.getKeyNames('HKEY_CLASSES_ROOT', hivesPath);
    if (hives.length === 0) {
      log('debug', 'no hives', hivesPath);
      return undefined;
    }

    let name: string;

    hives.forEach(hive => {
      try {
        const namePath: string = path.join(hivesPath, hive);
        winapi.WithRegOpen('HKEY_CLASSES_ROOT', namePath, secondhkey => {
          const values: string[] = winapi.RegEnumValues(secondhkey).map(val => val.key);
          if (values.indexOf(displayName) !== -1) {
            name = winapi.RegGetValue('HKEY_CLASSES_ROOT', namePath, displayName).value as string;
          }
        });
      } catch (err) {
        log('debug', 'failed to open hive', { hivesPath, hive });
        return undefined;
      }
    });
    return name;
  }

  // Given the registry path we're using to find game entries
  //  there's a high probability we will create entries for regular Microsoft
  //  store apps as well as Xbox games. At the time of creation, we were not
  //  able to find a cleaner registry path, and therefore will have to filter
  //  ignorable packages using the IGNORABLE array we defined at the top of
  //  this script.
  private async getGameEntries(): Promise<IXboxEntry[]> {
    return (this.isXboxInstalled === false) // No point in doing this if the app isn't installed!
      ? Promise.resolve([])
      : new Promise<IXboxEntry[]>(async (resolve, reject) => {
      try {
        const mutableLinkMap = this.mutableLinkMap();
        const gameMap: GamePathMap = await findInstalledGames(this.mApi);
        winapi.WithRegOpen('HKEY_CLASSES_ROOT', REPOSITORY_PATH, async hkey => {
          const keys: string[] = winapi.RegEnumKeys(hkey)
            .filter(key => IGNORABLE.find(ign => key.key.toLowerCase().startsWith(ign)) === undefined)
            .map(key => key.key);
          log('info', 'xbox store unignored entries:', keys.length);
          const gameEntries: IXboxEntry[] = await keys.reduce(async (accumP: Promise<IXboxEntry[]>, key) => {
            const accum = await accumP;
            // The full package id containing an entry's identity, version and publisher id.
            const packageId = key;

            let executionName: string;
            const firstKeyName: string = this.getFirstKeyName('HKEY_CLASSES_ROOT', path.join(REPOSITORY_PATH2, key));
            if (!!firstKeyName) {
              const split = firstKeyName.split('!');
              executionName = split.length > 1 ? split[split.length - 1] : 'App';
            } else {
              // Default app name.
              executionName = 'App';
            }

            // Publisher id is expected to be at the very end of the key,
            //  following the last underscore in the entry's name.
            const publisherId: string = key.substr(key.lastIndexOf('_') + 1);

            // The App's identity is separated from the rest of the entry using
            //  the first encountered underscore.
            const appid: string = key.substring(0, key.indexOf('_'));

            // Will store the game's name once we're able to find it...
            let name: string;

            // Display name entry is generally resolved to the game's actual name
            //  but might be pointing towards a different key in registry...
            let displayName: string;
            try {
              displayName = winapi.RegGetValue('HKEY_CLASSES_ROOT', REPOSITORY_PATH + '\\' + key, 'DisplayName').value as string;
            } catch (err) {
              log('info', 'gamestore-xbox: unable to query app display name', key);
              return Promise.resolve(accum);
            }

            name = (displayName.startsWith('@'))
              ? this.resolveRef(packageId, displayName)
              : displayName;

            // Generally the PackageRootFolder will already point to the mutable directory;
            //  but we've encountered situations (gamebryo games) where the PackageRootFolder
            //  although mutable, contains the version of the game which may change as the game
            //  gets updated - this is why we attempt to resolve the absolute mutable location through
            //  the HKLM hive as well - if it's undefined, we just used PackageRootFolder.
            let gamePath: string;
            try {
              gamePath = winapi.RegGetValue(hkey, key, 'PackageRootFolder').value as string;
            } catch (err) {
              // This is valid if the game was never run before.
              gamePath = gameMap?.[appid];
              if (gamePath === undefined) {
                return Promise.resolve(accum);
              }
            }
            const mutableLocation = (gameMap[appid] !== undefined)
              ? gameMap[appid]
              : this.resolveMutableLocation(gamePath, mutableLinkMap);
            try {
              const gameEntry: IXboxEntry = {
                appid,
                publisherId,
                packageId,
                executionName,
                gamePath: (mutableLocation !== undefined) ? mutableLocation : gamePath,
                name,
                gameStoreId: STORE_ID,
              };

              if (gameEntry?.gamePath) {
                const manifestData = await this.getAppManifestData(gameEntry.gamePath);
                accum.push({ ...gameEntry, manifestData });
              } else {
                accum.push(gameEntry);
              }
            } catch (err) {
              log('error', 'gamestore-xbox: unable to query the app game path', key);
            }
            return Promise.resolve(accum);
          }, Promise.resolve([]));

          return resolve(gameEntries);
        });
      } catch (err) {
        log('info', 'gamestore-xbox: failed to read repository', err.message);
        return reject(err);
      }
    });
  }
}

function main(context: types.IExtensionContext) {
  const instance: types.IGameStore =
    process.platform === 'win32' ? new XboxLauncher(context.api) : undefined;

  if (instance !== undefined) {
    context.registerGameStore(instance);
  }

  return true;
}

export default main;
