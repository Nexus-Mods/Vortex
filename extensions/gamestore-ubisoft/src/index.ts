// Ensure return types align with IGameStore's Bluebird-based signatures

import * as path from 'path';
import * as fs from 'fs-extra';

import { log, types, util } from 'vortex-api';
import Bluebird = require('bluebird');

const STORE_ID = 'ubisoft';
const STORE_NAME = 'Ubisoft Connect';
const STORE_PRIORITY = 55;
const UBISOFT_MAC_EXEC = 'Ubisoft Connect.app';

/**
 * base class to interact with local Ubisoft Connect game store.
 * @class UbisoftLauncher
 */
class UbisoftLauncher implements types.IGameStore {
  public id: string = STORE_ID;
  public name: string = STORE_NAME;
  public priority: number = STORE_PRIORITY;
  private mClientPath: Bluebird<string | undefined>;
  private mCache: Bluebird<types.IGameStoreEntry[]> | undefined;

  constructor() {
    if (process.platform === 'win32') {
      // Windows implementation (existing Uplay functionality)
      try {
        Bluebird.resolve(import('winapi-bindings')).then((mod: any) => {
          const winapi: any = mod?.default ?? mod;
          const uplayPath = winapi.RegGetValue(
            'HKEY_LOCAL_MACHINE',
            'SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher',
            'InstallDir',
          );
          this.mClientPath = Bluebird.resolve(
            path.join(uplayPath.value as string, 'UbisoftConnect.exe')
          );
        }).catch((err: any) => {
          log('info', 'Ubisoft launcher not found', { error: (err as any)?.message });
          this.mClientPath = Bluebird.resolve(undefined);
        });
      } catch (err) {
        log('info', 'Ubisoft launcher not found', { error: (err as any)?.message });
        this.mClientPath = Bluebird.resolve(undefined);
      }
    } else if (process.platform === 'darwin') {
      // macOS implementation
      this.mClientPath = this.findMacOSUbisoftPath().catch((err: any) => {
        log('info', 'Ubisoft launcher not found on macOS', { error: (err as any)?.message });
        return undefined;
      });
    } else {
      log('info', 'Ubisoft launcher not found', { error: 'unsupported platform' });
      this.mClientPath = Bluebird.resolve(undefined);
    }
  }

  /**
   * Find Ubisoft Connect on macOS
   */
  private findMacOSUbisoftPath(): Bluebird<string> {
    // Check standard installation paths
    const possiblePaths = [
      '/Applications/Ubisoft Connect.app',
      path.join(process.env.HOME || '', 'Applications', 'Ubisoft Connect.app')
    ];

    return Bluebird.all(
      possiblePaths.map((appPath) =>
        Bluebird.resolve(fs.stat(appPath))
          .then(stat => (stat.isDirectory() ? appPath : undefined))
          .catch(() => undefined)
      )
    ).then((results) => {
      const found = results.find(p => !!p) as string | undefined;
      if (found) {
        return Bluebird.resolve(found as string);
      }
      return Bluebird.reject(new Error('Ubisoft Connect not found on macOS'));
    });
  }

  public launchGame(appId: any, api?: types.IExtensionApi): Bluebird<void> {
    return Bluebird.try(async () => {
      await this.launchGameAsync(appId, api);
    });
  }

  private async launchGameAsync(appInfo: any, api?: types.IExtensionApi): globalThis.Promise<void> {
    const appId = ((typeof(appInfo) === 'object') && ('appId' in appInfo))
      ? appInfo.appId : appInfo.toString();

    // Ubisoft Connect can launch multiple executables for a game.
    // The way they differentiate between executables is using the appended
    // digit at the end of the posix path.
    // e.g. 'ubisoft://launch/619/0' will launch a game (Singleplayer)
    // while 'ubisoft://launch/619/1' will launch the same game (Multiplayer)
    // '0' seems to be the default value reason why we simply hard code it; we may
    // need to change this in the future to allow game extensions to choose the executable
    // they want to launch.
    const posixPath = `ubisoft://launch/${appId}/0`;
    try {
      await util.opn(posixPath);
    } catch (err) {
      // swallow errors to satisfy contract
    }
  }

  public allGames(): Bluebird<types.IGameStoreEntry[]> {
    if (this.mCache === undefined) {
      this.mCache = this.getGameEntries();
    }
    return this.mCache;
  }

  public reloadGames(): Bluebird<void> {
    this.mCache = undefined;
    return Bluebird.resolve();
  }

  public findByName(appName: string): Bluebird<types.IGameStoreEntry> {
    const re = new RegExp('^' + appName + '$');
    return this.allGames()
      .then(entries => entries.find(entry => re.test(entry.name)))
      .then(entry => (entry === undefined)
        ? Bluebird.reject(new types.GameEntryNotFound(appName, STORE_ID))
        : Bluebird.resolve(entry));
  }

  public findByAppId(appId: string | string[]): Bluebird<types.IGameStoreEntry> {
    const matcher = Array.isArray(appId)
      ? (entry: types.IGameStoreEntry) => (appId.includes(entry.appid))
      : (entry: types.IGameStoreEntry) => (appId === entry.appid);

    return this.allGames()
      .then(entries => {
        const gameEntry = entries.find(matcher);
        if (gameEntry === undefined) {
          return Bluebird.reject(
            new types.GameEntryNotFound(Array.isArray(appId) ? appId.join(', ') : appId, STORE_ID));
        } else {
          return Bluebird.resolve(gameEntry);
        }
      });
  }

  public getGameStorePath(): Bluebird<string> {
    return this.mClientPath
      ? this.mClientPath.then(x => (x ?? ''))
      : Bluebird.resolve('');
  }

  private getGameEntries(): Bluebird<types.IGameStoreEntry[]> {
    if (process.platform === 'win32') {
      return this.getGameEntriesWindows();
    } else if (process.platform === 'darwin') {
      return this.getGameEntriesMacOS();
    } else {
      return Bluebird.resolve([]);
    }
  }

  private getGameEntriesWindows(): Bluebird<types.IGameStoreEntry[]> {
    return (!!this.mClientPath)
      ? Bluebird.resolve(import('winapi-bindings')).then((mod: any) => {
        const winapi: any = mod?.default ?? mod;
        return new (Bluebird as any).Promise((resolve: (v: types.IGameStoreEntry[]) => void,
                                             reject: (err: any) => void) => {
          try {
            winapi.WithRegOpen('HKEY_LOCAL_MACHINE',
                               'SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs', (hkey: any) => {
                                 let keys: any[] = [];
                                 try {
                                   keys = winapi.RegEnumKeys(hkey);
                                 } catch (err) {
                // Can't open the hive tree... weird.
                                   log('error', 'gamestore-ubisoft: registry query failed', { hkey });
                                   return resolve([]);
                                 }
                                 const gameEntries: types.IGameStoreEntry[] = keys.map((key: any) => {
                                   try {
                                     const gameEntry: types.IGameStoreEntry = {
                                       appid: key.key,
                                       gamePath: winapi.RegGetValue(hkey,
                                                                    key.key, 'InstallDir').value as string,
                    // Unfortunately the name of this game is stored elsewhere.
                                       name: winapi.RegGetValue('HKEY_LOCAL_MACHINE',
                                                                'SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Uplay Install ' + key.key,
                                                                'DisplayName').value as string,
                                       gameStoreId: STORE_ID,
                                     };
                                     return gameEntry;
                                   } catch (err) {
                                     log('info', 'gamestore-ubisoft: registry query failed', { key: key.key });
                                     return undefined;
                                   }
                                 });
                                 return resolve(gameEntries.filter(entry => !!entry));
                               });
          } catch (err) {
            return ((err as any)?.code === 'ENOENT') ? resolve([]) : reject(err);
          }
        }) as Bluebird<types.IGameStoreEntry[]>;
      }).catch(() => Bluebird.resolve([]))
      : Bluebird.resolve([]);
  }

  private getGameEntriesMacOS(): Bluebird<types.IGameStoreEntry[]> {
    return Bluebird.try(async () => {
      // On macOS, Ubisoft Connect stores data in ~/Library/Application Support/Ubisoft/Ubisoft Game Launcher
      const homeDir = process.env.HOME || '';
      const ubisoftDataPath = path.join(homeDir, 'Library', 'Application Support', 'Ubisoft', 'Ubisoft Game Launcher');
      
      // Check if Ubisoft data directory exists
      try {
        await fs.stat(ubisoftDataPath);
      } catch (err) {
        // Ubisoft data directory not found
        return [] as types.IGameStoreEntry[];
      }
      
      // Look for game information in the cache directory
      const cachePath = path.join(ubisoftDataPath, 'cache');
      const gamesPath = path.join(cachePath, 'configuration', 'games');
      
      let gameDirs: string[] = [];
      try {
        gameDirs = await fs.readdir(gamesPath);
      } catch (err) {
        // Games directory not found
        return [] as types.IGameStoreEntry[];
      }
      
      const gameEntries: types.IGameStoreEntry[] = [];
      
      // Process each game directory
      for (const gameId of gameDirs) {
        try {
          const gameInfoPath = path.join(gamesPath, gameId, 'game_info.yaml');
          // Check if game info file exists
          try {
            await fs.stat(gameInfoPath);
            // Parse game info (simplified - in reality would need to parse YAML)
            // For now, we'll just get basic info from directory structure
            const gameName = this.getGameNameFromId(gameId);
            const gamePath = await this.findGameInstallationPath(gameId);
            
            if (gamePath) {
              gameEntries.push({
                appid: gameId,
                name: gameName,
                gamePath: gamePath,
                gameStoreId: STORE_ID,
              });
            }
          } catch (err) {
            // Game info file not found, try alternative method
            const gamePath = await this.findGameInstallationPath(gameId);
            if (gamePath) {
              const gameName = this.getGameNameFromId(gameId);
              gameEntries.push({
                appid: gameId,
                name: gameName,
                gamePath: gamePath,
                gameStoreId: STORE_ID,
              });
            }
          }
        } catch (err) {
          // Failed to process game directory
          log('debug', 'Failed to process Ubisoft game directory', { gameId, error: (err as any)?.message });
        }
      }
      
      return gameEntries;
    }).catch((err: any) => {
      log('error', 'Failed to get Ubisoft games on macOS', { error: (err as any)?.message });
      return [] as types.IGameStoreEntry[];
    });
  }

  private getGameNameFromId(gameId: string): string {
    // This is a simplified implementation - in reality, Ubisoft stores game names
    // in a more complex structure. For now, we'll use the ID as name if we can't find better info.
    const gameNames: { [key: string]: string } = {
      // Common Ubisoft game IDs (this would need to be expanded)
      '42': 'Assassin\'s Creed Origins',
      '43': 'Assassin\'s Creed Odyssey',
      '44': 'Assassin\'s Creed Valhalla',
      '57': 'Far Cry 5',
      '58': 'Far Cry New Dawn',
      '59': 'Far Cry 6',
      '60': 'Watch Dogs',
      '61': 'Watch Dogs 2',
      '62': 'Watch Dogs: Legion',
    };
    
    return gameNames[gameId] || `Ubisoft Game ${gameId}`;
  }

  private async findGameInstallationPath(gameId: string): globalThis.Promise<string | null> {
    try {
      // Check common installation paths
      const homeDir = process.env.HOME || '';
      const commonPaths = [
        path.join(homeDir, 'Applications', 'Ubisoft', 'Ubisoft Game Launcher', 'games'),
        path.join(homeDir, 'Games', 'Ubisoft'),
        '/Applications/Ubisoft Games',
        '/Games/Ubisoft'
      ];
      
      for (const basePath of commonPaths) {
        try {
          const gamePath = path.join(basePath, gameId);
          const stat = await fs.stat(gamePath);
          if (stat.isDirectory()) {
            return gamePath;
          }
        } catch (err) {
          // Continue to next path
        }
      }
      
      // Try to find in any subdirectory
      for (const basePath of commonPaths) {
        try {
          const dirs = await fs.readdir(basePath);
          for (const dir of dirs) {
            const fullPath = path.join(basePath, dir);
            try {
              const stat = await fs.stat(fullPath);
              if (stat.isDirectory() && dir.includes(gameId)) {
                return fullPath;
              }
            } catch (err) {
              // Continue
            }
          }
        } catch (err) {
          // Continue to next path
        }
      }
    } catch (err) {
      log('debug', 'Failed to find game installation path', { gameId, error: (err as any)?.message });
    }
    
    return null;
  }
}

function main(context: types.IExtensionContext) {
  const instance: types.IGameStore = new UbisoftLauncher();

  if (instance !== undefined) {
    context.registerGameStore(instance);
  }

  return true;
}

export { UbisoftLauncher };
export default main;
