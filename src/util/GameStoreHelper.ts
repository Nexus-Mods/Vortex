import Bluebird from 'bluebird';
import * as path from 'path';

import * as fs from '../util/fs';
import { log } from '../util/log';

import * as winapi from 'winapi-bindings';
import { makeExeId } from '../reducers/session';

import { getGameStores } from '../extensions/gamemode_management/util/getGame';

import { ProcessCanceled, UserCanceled } from '../util/CustomErrors';
import { GameEntryNotFound, GameStoreNotFound, IGameStore } from '../types/IGameStore';
import { IGameStoreEntry } from '../types/IGameStoreEntry';
import { IExtensionApi } from '../types/IExtensionContext';
import getNormalizeFunc from './getNormalizeFunc';
import { toBlue } from './util';

type SearchType = 'name' | 'id';

export interface IStoreQuery {
  id?: string;
  name?: string;
  prefer?: number;
}

class GameStoreHelper {
  private mApi: IExtensionApi;
  private mStores: IGameStore[];
  private mStoresDict: { [storeId: string]: IGameStore };

  // Search for a specific game store.
  public getGameStore(storeId: string): IGameStore {
    const gameStores = this.getStores();
    const gameStore = gameStores.find(store => store.id === storeId);
    if ((gameStores.length) > 0 && (gameStore === undefined)) {
      // The game stores are guaranteed to have loaded at this point,
      //  yet the store Id we're looking for is not in the store array.
      throw new GameStoreNotFound(storeId);
    }

    return gameStore;
  }

  // Returns the id of the first game store that has
  //  an existing game entry for the game we're looking for.
  //  Will return undefined if no store has a matching game entry.
  // OR
  // If a store id is specified, it will return the provided
  //  store id if the game is installed using the specified store id;
  //  otherwise will return undefined.
  public isGameInstalled(id: string, storeId?: string): Bluebird<string> {
    return ((storeId !== undefined)
      ? this.findGameEntry('id', id, storeId)
      : this.findGameEntry('id', id))
      .then(entry => Bluebird.resolve(entry?.gameStoreId))
      .catch(() => Bluebird.resolve(undefined));
  }

  public isGameStoreInstalled(storeId: string): Bluebird<boolean> {
    try {
      const gameStore = this.getGameStore(storeId);
      return (!!gameStore.isGameStoreInstalled)
        ? gameStore.isGameStoreInstalled()
        : gameStore.getGameStorePath()
          .then(execPath => (execPath === undefined)
            ? Bluebird.reject(new Error(`failed to determine path for ${storeId}`))
            : fs.statAsync(execPath))
          .then(() => Bluebird.resolve(true))
          .catch(err => {
            log('debug', 'gamestore is not installed', err);
            return Bluebird.resolve(false);
          });
    } catch (err) {
      return Bluebird.resolve(false);
    }
  }

  public registryLookup(lookup: string): Bluebird<IGameStoreEntry> {
    if (lookup === undefined) {
      return Bluebird.reject(new Error('invalid store query, provide an id!'));
    }

    const chunked = lookup.split(':', 3);

    if (chunked.length !== 3) {
      return Bluebird.reject(new Error('invalid query, should be hive:path:key'));
    }

    if (!['HKEY_CLASSES_ROOT', 'HKEY_CURRENT_CONFIG',
      'HKEY_CURRENT_USER', 'HKEY_LOCAL_MACHINE', 'HKEY_USERS'].includes(chunked[0])) {

      return Bluebird.reject(new Error('invalid query, hive should be something like HKEY_LOCAL_MACHINE'));
    }

    try {
      const instPath = winapi.RegGetValue(chunked[0] as any, chunked[1], chunked[2]);
      if (!instPath || (instPath.type !== 'REG_SZ')) {
        throw new Error('empty or invalid registry key');
      }

      const result: IGameStoreEntry = {
        appid: lookup,
        gamePath: instPath.value as string,
        gameStoreId: undefined,
        name: path.basename(instPath.value as string),
        priority: 100,
      };
      return Bluebird.resolve(result);
    } catch (err) {
      return Bluebird.reject(new GameEntryNotFound(lookup, 'registry'));
    }
  }

  public find = toBlue(async (query: IStoreQuery): Promise<IGameStoreEntry[]> => {
    const results: IGameStoreEntry[] = [];
    for (const storeId of Object.keys(query)) {
      let prioOffset = 0;
      for (const storeQuery of query[storeId]) {
        let result: IGameStoreEntry;
        try {
          if (storeId === 'registry') {
            result = await this.registryLookup(storeQuery.id);
          } else if (storeQuery.id !== undefined) {
            result = await this.findGameEntry('id', storeQuery.id, storeId);
          } else if (storeQuery.name !== undefined) {
            result = await this.findGameEntry('name', storeQuery.name, storeId);
          } else {
            throw new Error('invalid store query, set either id or name');
          }
        } catch (err) {
          if (!(err instanceof GameEntryNotFound)) {
            log('error', 'Failed to look up game',
                { storeId, appid: storeQuery.id, name: storeQuery.name });
          }
        }
        if (result !== undefined) {
          result.priority = storeQuery.prefer
            ?? this.mStoresDict[result.gameStoreId]?.priority
            ?? 100;
          result.priority += (prioOffset++) / 1000;
          results.push(result);
        }
      }
    }
    return results;
  });

  public findByName(name: string | string[], storeId?: string): Bluebird<IGameStoreEntry> {
    return this.validInput(name)
      ? this.findGameEntry('name', name, storeId)
      : Bluebird.reject(new GameEntryNotFound('Invalid name input', this.mStores.map(store => store.id).join(', ')));
  }

  public findByAppId(appId: string | string[], storeId?: string): Bluebird<IGameStoreEntry> {
    return this.validInput(appId)
      ? this.findGameEntry('id', appId, storeId)
      : Bluebird.reject(new GameEntryNotFound('Invalid appId input', this.mStores.map(store => store.id).join(', ')));
  }

  public launchGameStore(api: IExtensionApi, gameStoreId: string,
                         parameters?: string[], askConsent: boolean = false): Bluebird<void> {
    let gameStore: IGameStore;
    try {
      gameStore = this.getGameStore(gameStoreId);
      if (!gameStore.getGameStorePath) {
        throw new ProcessCanceled('gamestore implementation does not define getGameStorePath');
      }
    } catch (err) {
      api.showErrorNotification('Failed to launch game store', err);
      return Bluebird.resolve();
    }

    const t = api.translate;
    const launchStore = () => this.isGameStoreInstalled(gameStoreId)
      .then((gamestoreInstalled) => {
        if (!gamestoreInstalled) {
          api.showErrorNotification('Game store is not installed',
            t('Please install/reinstall {{storeId}} to be able to launch this game store.',
              { replace: { storeId: gameStoreId } }), { allowReport: false });
          return Bluebird.resolve();
        }

        // Game Store specific launch has priority.
        if (!!gameStore.launchGameStore) {
          return gameStore.launchGameStore(api, parameters)
            .catch(err => {
              api.showErrorNotification('Failed to launch game store', err);
              return Bluebird.resolve();
            });
        }

        return gameStore.getGameStorePath()
          .then(launcherPath => {
            if (!!launcherPath && !this.isStoreRunning(launcherPath)) {
              api.runExecutable(launcherPath, parameters || [], {
                detach: true,
                suggestDeploy: false,
              });
            }
            return Bluebird.resolve();
        });
    });

    const isGameStoreRunning = () => (!!gameStore.getGameStorePath)
      ? gameStore.getGameStorePath()
        .then(launcherPath => !!launcherPath && this.isStoreRunning(launcherPath))
      : Bluebird.resolve(false);

    const askConsentDialog = () => {
      return isGameStoreRunning().then(res => (res)
        ? Bluebird.resolve()
        : new Bluebird((resolve, reject) => {
        api.showDialog('info', api.translate('Game Store not Started'), {
          text: api.translate('The game requires {{storeid}} to be running in parallel. '
            + 'Vortex will now attempt to start up the store for you.',
              { replace: { storeid: gameStoreId } }),
        }, [
          { label: 'Cancel', action: () => reject(new UserCanceled()) },
          { label: 'Start Store', action: () => resolve() },
        ]);
      }));
    };

    // Ask consent or start up the store directly.
    const startStore = () => (askConsent)
      ? askConsentDialog()
          .then(() => launchStore())
          .catch(err => Bluebird.resolve())
      : launchStore();

    // Start up the store.
    return startStore();
  }

  public identifyStore = toBlue(async (gamePath: string) => {
    const normalize = await getNormalizeFunc(gamePath);

    const fallback = async (store: IGameStore, gamePath: string): Promise<boolean> => {
      try {
        const gameInfo = (await store.allGames()).find(game =>
          normalize(game.gamePath) === normalize(gamePath));

        return gameInfo !== undefined;
      } catch (err) {
        return false;
      }
    };

    for (const store of this.getStores()) {
      if (store.identifyGame !== undefined) {
        if (await store.identifyGame?.(gamePath, gamePath => fallback(store, gamePath))) {
          return store.id;
        }
      } else {
        if (await fallback(store, gamePath)) {
          return store.id;
        }
      }
    }
    return undefined;
  });

  public reloadGames(api?: IExtensionApi): Bluebird<void> {
    if (!!api && !this.mApi) {
      this.mApi = api;
    }
    const stores = this.getStores().filter(store => !!store);
    this.mApi?.sendNotification({
      id: 'gamestore-reload',
      type: 'activity',
      message: 'Loading game stores...',
    });
    log('info', 'reloading game store games', stores.map(store => store.id)
                                                    .join(', '));
    return Bluebird.each(stores, (store: IGameStore) =>
      (store?.reloadGames !== undefined)
        ? store.reloadGames()
            .catch(err => {
              // Game store was unable to reload its games
              //  we log this and jump to the next store.
              err['gameStore'] = store.id;
              log('error', 'gamestore failed to reload its games', err);
              return Bluebird.resolve();
            })
        : Bluebird.resolve())
      .then(() => {
        this.mApi?.dismissNotification('gamestore-reload');
        return Bluebird.resolve()
      });
  }

  /**
   * @returns list of stores, sorted by priority
   */
  public storeIds(): IGameStore[] {
    return this.mStores
      .sort((lhs: IGameStore, rhs: IGameStore) => lhs.priority - rhs.priority);
  }

  private isStoreRunning(storeExecPath: string) {
    const runningProcesses = winapi.GetProcessList();
    const exeId = makeExeId(storeExecPath);
    return runningProcesses.find(runningProc =>
      (exeId === runningProc.exeFile.toLowerCase())) !== undefined;
  }

  private validInput(input: string | string[]): boolean {
    return (!input || (Array.isArray(input) && input.length === 0)) ? false : true;
  }

  private getStores(): IGameStore[] {
    if (!!this.mStores) {
      return this.mStores;
    }
    // It's possible that the game mode manager has yet
    //  to load the stores.
    try {
      this.mStores = getGameStores();
      this.mStoresDict = this.mStores.reduce(
        (prev: { [storeId: string]: IGameStore }, store: IGameStore) => {
          prev[store.id] = store;
          return prev;
        }, {});
      return this.mStores;
    } catch (err) {
      log('debug', 'stores have yet to load', err);
      return [];
    }
  }

  /**
   * Returns a store entry for a specified pattern.
   * @param searchType dictates which functor we execute.
   * @param pattern the pattern we're looking for.
   * @param storeId optional parameter used when trying to query a specific store.
   */
  private findGameEntry(searchType: SearchType,
                        pattern: string | string[],
                        storeId?: string): Bluebird<IGameStoreEntry> {
    const entryInfo = (entry: IGameStoreEntry): string =>
      (searchType === 'id') ? entry.appid : entry.name;

    const wrapNamePattern = (gameName) => {
      if (searchType !== 'name') {
        // Not a name searchType.
        return gameName;
      }
      // We need to match the game name _exactly_ otherwise
      //  false positives could occur, for example:
      //  The Elder Scrolls V: Skyrim could potentially match
      //  The Elder Scrolls V: Skyrim Special Edition, in which
      //  case the game extension will look for TESV.exe and be unable
      //  to find it, failing discovery completely even though the user
      //  has Oldrim installed in a different location.
      return '^' + gameName + '$';
    };

    // For obvious reasons, this should only be used for
    //  name searchTypes; using this for id's would potentially
    // cause false positives.
    const rgxMatcher = (Array.isArray(pattern))
      ? new RegExp(pattern.map(wrapNamePattern).join('|'))
      : new RegExp(wrapNamePattern(pattern));

    const matcher = (Array.isArray(pattern))
      ? entry => pattern.indexOf(entryInfo(entry)) !== -1
      : entry => entryInfo(entry) === pattern;

    const name = (Array.isArray(pattern))
      ? pattern.join(' - ')
      : pattern;

    const stores = this.mStores.map(store => store.id).join(', ');

    // queriedStore object is only populated if the game store helper caller
    //  is looking for a specific game store.
    let queriedStore: IGameStore;
    if (!!storeId) {
      try {
        queriedStore = this.getGameStore(storeId);
      } catch (err) {
        // It's possible for a game store to be missing
        //  especially if it is added by a 3rd party extension.
        log('warn', 'Game entry not found in specified store',
            { pattern: name, storeId, availableStores: stores });
        return Bluebird.reject(new GameEntryNotFound(name, stores));
      }
    }

    const gameStores: IGameStore[] = ((!!queriedStore)
      ? [queriedStore]
      : this.getStores()).filter(store => !!store);

    if ((gameStores === undefined) || (gameStores.length === 0)) {
      const stores = (gameStores !== undefined)
        ? gameStores.map(store => store.id).join(', ')
        : '';
      log('debug', 'Game entry not found', { pattern: name, availableStores: stores });
      return Bluebird.reject(new GameEntryNotFound(name, stores));
    }

    return Bluebird.reduce(gameStores, (accum: IGameStoreEntry[], store) =>
      store.allGames()
        .then(entries => {
          const entry = (searchType === 'id')
            ? entries.find(matcher)
            : entries.find(ent => rgxMatcher.test(ent.name));

          if (!!entry) {
            accum.push(entry);
          }

          return Bluebird.resolve(accum);
        })
        .catch(GameEntryNotFound, () => Bluebird.resolve([])), [])
      .then(foundEntries => {
        // TODO: A cool future feature here would be to allow the user to select
        //  the gamestore he wants to use. But for now, we just return the
        //  first instance we found.
        if (foundEntries.length > 0) {
          return Bluebird.resolve(foundEntries[0]);
        } else {
          log('debug', 'Game entry not found', { pattern: name, availableStores: stores });
          return Bluebird.reject(new GameEntryNotFound(name, stores));
        }
      });
  }
}

// const instance: GameStoreHelper = new GameStoreHelper();

const instance: GameStoreHelper = new Proxy({}, {
  get(target, name) {
    if (target['inst'] === undefined) {
      target['inst'] = new GameStoreHelper();
    }
    return target['inst'][name];
  },
  set(target, name, value) {
    if (target['inst'] === undefined) {
      target['inst'] = new GameStoreHelper();
    }
    target['inst'][name] = value;
    return true;
  },
}) as any;

export default instance;
