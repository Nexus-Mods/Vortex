import * as Promise from 'bluebird';

import * as path from 'path';
import * as winapi from 'winapi-bindings';

import { fs, log, types } from 'vortex-api';

const STORE_ID = 'gog';
const STORE_NAME = 'GOG';
// no DRM, does it get better than this?
const STORE_PRIORITY = 15;

const GOG_EXEC = 'GalaxyClient.exe';

const REG_GOG_GAMES = 'SOFTWARE\\WOW6432Node\\GOG.com\\Games';

/**
 * base class to interact with local GoG Galaxy client
 * @class GoGLauncher
 */
class GoGLauncher implements types.IGameStore {
  public id: string = STORE_ID;
  public name: string = STORE_NAME;
  public priority: number = STORE_PRIORITY;
  private mClientPath: Promise<string>;
  private mCache: Promise<types.IGameStoreEntry[]>;

  constructor() {
    if (process.platform === 'win32') {
      // No Windows, no gog launcher!
      try {
        const gogPath = winapi.RegGetValue('HKEY_LOCAL_MACHINE',
          'SOFTWARE\\WOW6432Node\\GOG.com\\GalaxyClient\\paths', 'client');
        this.mClientPath = Promise.resolve(gogPath.value as string);
      } catch (err) {
        log('info', 'gog not found', { error: err.message });
        this.mClientPath = undefined;
      }
    } else {
      log('info', 'gog not found', { error: 'only available on Windows systems' });
      this.mClientPath = undefined;
    }
  }

  /**
   * find the first game that matches the specified name pattern
   */
  public findByName(namePattern: string): Promise<types.IGameStoreEntry> {
    const re = new RegExp('^' + namePattern + '$');
    return this.allGames()
      .then(entries => entries.find(entry => re.test(entry.name)))
      .then(entry => {
        if (entry === undefined) {
          return Promise.reject(new types.GameEntryNotFound(namePattern, STORE_ID));
        } else {
          return Promise.resolve(entry);
        }
      });
  }

  public launchGame(appInfo: any, api?: types.IExtensionApi): Promise<void> {
    return this.getExecInfo(appInfo)
      .then(execInfo =>
        api.runExecutable(execInfo.execPath, execInfo.arguments, {
          cwd: path.dirname(execInfo.execPath),
          suggestDeploy: true,
          shell: true,
      }));
  }

  public getExecInfo(appId: string): Promise<types.IExecInfo> {
    return this.allGames()
      .then(entries => {
        const gameEntry = entries.find(entry => entry.appid === appId);
        return (gameEntry === undefined)
          ? Promise.reject(new types.GameEntryNotFound(appId, STORE_ID))
          : this.mClientPath.then((basePath) => {
              const gogClientExec = {
                execPath: path.join(basePath, GOG_EXEC),
                arguments: ['/command=runGame',
                            `/gameId=${gameEntry.appid}`,
                            `path="${gameEntry.gamePath}"`],
              };

              return Promise.resolve(gogClientExec);
            });
      });
  }

  /**
   * find the first game with the specified appid or one of the specified appids
   */
  public findByAppId(appId: string | string[]): Promise<types.IGameStoreEntry> {
    const matcher = Array.isArray(appId)
      ? (entry: types.IGameStoreEntry) => (appId.includes(entry.appid))
      : (entry: types.IGameStoreEntry) => (appId === entry.appid);

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

  public allGames(): Promise<types.IGameStoreEntry[]> {
    if (!this.mCache) {
      this.mCache = this.getGameEntries();
    }
    return this.mCache;
  }

  public reloadGames(): Promise<void> {
    return new Promise((resolve) => {
      this.mCache = this.getGameEntries();
      return resolve();
    });
  }

  public getGameStorePath(): Promise<string> {
    return (!!this.mClientPath)
      ? this.mClientPath.then(basePath => Promise.resolve(path.join(basePath, 'GalaxyClient.exe')))
      : Promise.resolve(undefined);
  }

  public identifyGame(gamePath: string,
                      fallback: (gamePath: string) => PromiseLike<boolean>)
                      : Promise<boolean> {
    return Promise.all([this.fileExists(path.join(gamePath, 'gog.ico')), fallback(gamePath)])
      .then(([custom, fallback]) => {
        if (custom !== fallback) {
          log('warn', '(gog) game identification inconclusive', {
            gamePath,
            custom,
            fallback,
          });
        }
        return custom || fallback;
      });
  }

  private fileExists(filePath: string): PromiseLike<boolean> {
    return fs.statAsync(filePath)
      .then(() => true)
      .catch(() => false);
  }

  private getGameEntries(): Promise<types.IGameStoreEntry[]> {
    return (!!this.mClientPath)
      ? new Promise<types.IGameStoreEntry[]>((resolve, reject) => {
        try {
          winapi.WithRegOpen('HKEY_LOCAL_MACHINE', REG_GOG_GAMES, hkey => {
            const keys = winapi.RegEnumKeys(hkey);
            const gameEntries: types.IGameStoreEntry[] = keys.map(key => {
              try {
                const gameEntry: types.IGameStoreEntry = {
                  appid: winapi.RegGetValue(hkey, key.key, 'gameID').value as string,
                  gamePath: winapi.RegGetValue(hkey, key.key, 'path').value as string,
                  name: winapi.RegGetValue(hkey, key.key, 'startMenu').value as string,
                  gameStoreId: STORE_ID,
                };
                return gameEntry;
              } catch (err) {
                log('error', 'gamestore-gog: failed to create game entry', err);
                // Don't stop, keep going.
                return undefined;
              }
            }).filter(entry => !!entry);
            return resolve(gameEntries);
          });
        } catch (err) {
          return (err.code === 'ENOENT') ? resolve([]) : reject(err);
        }
    })
    : Promise.resolve([]);
  }
}

function main(context: types.IExtensionContext) {
  const instance: types.IGameStore =
    process.platform === 'win32' ? new GoGLauncher() : undefined;

  if (instance !== undefined) {
    context.registerGameStore(instance);
  }

  return true;
}

export default main;
