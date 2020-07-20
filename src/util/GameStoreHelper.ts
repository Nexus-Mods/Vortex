import Promise from 'bluebird';
import { GameEntryNotFound, GameStoreNotFound,
  IExtensionApi, IGameStore, IGameStoreEntry } from '../types/api';
import { log } from '../util/log';

import EpicGamesLauncher from './EpicGamesLauncher';
import Steam, { GameNotFound } from './Steam';

import * as winapi from 'winapi-bindings';
import { makeExeId } from '../reducers/session';

import { getGameStores } from '../extensions/gamemode_management/util/getGame';

import { UserCanceled } from '../util/CustomErrors';

type SearchType = 'name' | 'id';

class GameStoreHelper {
  private mStores: IGameStore[];

  // Search for a specific game store.
  public getGameStore(storeId: string): IGameStore {
    return this.getstores().find(store => store.id === storeId);
  }

  // Returns the id of the first game store that has
  //  an existing game entry for the game we're looking for.
  //  Will return undefined if no store has a matching game entry.
  // OR
  // If a store id is specified, it will return the provided
  //  store id if the game is installed using the specified store id;
  //  otherwise will return undefined.
  public isGameInstalled(id: string, storeId?: string): Promise<string> {
    return ((storeId !== undefined)
      ? this.findGameEntry('id', id, storeId)
      : this.findGameEntry('id', id))
      .then(entry => entry.gameStoreId)
      .catch(err => Promise.resolve(undefined));
  }

  public findByName(name: string | string[], storeId?: string): Promise<IGameStoreEntry> {
    return this.findGameEntry('name', name, storeId);
  }

  public findByAppId(appId: string | string[], storeId?: string): Promise<IGameStoreEntry> {
    return this.findGameEntry('id', appId, storeId);
  }

  public launchGameStore(api: IExtensionApi, gameStoreId: string,
                         parameters?: string[], askConsent: boolean = false): Promise<void> {
    const gameStore = this.getGameStore(gameStoreId);
    if (gameStore === undefined) {
      api.showErrorNotification('Unknown game store id', gameStoreId);
      return Promise.resolve();
    }

    const launchStore = () => {
      // Game Store specific launch has priority.
      if (!!gameStore.launchGameStore) {
        return gameStore.launchGameStore(api, parameters)
          .catch(err => {
            api.showErrorNotification('Failed to launch game store', err);
            return Promise.resolve();
          });
      }

      if (!!gameStore.getGameStorePath) {
        return gameStore.getGameStorePath()
          .then(launcherPath => {
            if (!!launcherPath && !this.isStoreRunning(launcherPath)) {
              api.runExecutable(launcherPath, parameters || [], { suggestDeploy: false });
            }
            return Promise.resolve();
          });
      }

      api.showErrorNotification('Game store not configured correctly', gameStoreId);
      return Promise.resolve();
    };

    const isGameStoreRunning = () => (!!gameStore.getGameStorePath)
      ? gameStore.getGameStorePath()
        .then(launcherPath => !!launcherPath && this.isStoreRunning(launcherPath))
      : Promise.resolve(false);

    const askConsentDialog = () => {
      return isGameStoreRunning().then(res => (res)
        ? Promise.resolve()
        : new Promise((resolve, reject) => {
        api.showDialog('info', api.translate('Game Store not Started'), {
          text: api.translate('The game requires {{storeid}} to be running in parallel. '
            + 'Vortex will now attempt to start up the store for you.',
              { replace: { storeid: gameStoreId } }),
        }, [
          { label: 'Cancel', action: () => reject(new UserCanceled()) },
          { label: 'Ok', action: () => resolve() },
        ]);
      }));
    };

    // Ask consent or start up the store directly.
    const startStore = () => (askConsent)
      ? askConsentDialog()
          .then(() => launchStore())
          .catch(err => Promise.resolve())
      : launchStore();

    // Start up the store.
    return startStore();
  }

  private isStoreRunning(storeExecPath: string) {
    const runningProcesses = winapi.GetProcessList();
    const exeId = makeExeId(storeExecPath);
    return runningProcesses.find(runningProc =>
      (exeId === runningProc.exeFile.toLowerCase())) !== undefined;
  }

  private getstores(): IGameStore[] {
    if (!!this.mStores) {
      return this.mStores;
    }
    // It's possible that the game mode manager has yet
    //  to load the stores.
    try {
      this.mStores = [Steam, EpicGamesLauncher, ...getGameStores()];
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
                        storeId?: string): Promise<IGameStoreEntry> {
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

    const matcher = Array.isArray(pattern)
      ? entry => pattern.indexOf(entryInfo(entry)) !== -1
      : entry => entryInfo(entry) === pattern;

    const gameStores = ((!!storeId)
      ? [this.getGameStore(storeId)]
      : this.getstores()).filter(store => !!store);

    if ((gameStores === undefined) || (gameStores.length === 0)) {
      const errMsg = (!!storeId) ? storeId : 'Gamestores unavailable';
      return Promise.reject(new GameStoreNotFound(errMsg));
    }

    return Promise.reduce(gameStores, (accum: IGameStoreEntry[], store) =>
      store.allGames()
      .then(entries => {
        const entry = (searchType === 'id')
          ? entries.find(matcher)
          : entries.find(ent => rgxMatcher.test(ent.name));

        if (!!entry) {
          accum.push(entry);
        }

        return Promise.resolve(accum);
      })
      .catch(GameEntryNotFound, () => Promise.resolve([]))
      .catch(GameNotFound, () => Promise.resolve([])), [])
      .then(foundEntries => {
        // TODO: A cool future feature here would be to allow the user to select
        //  the gamestore he wants to use. But for now, we just return the
        //  first instance we found.
        if (foundEntries.length > 0) {
          return Promise.resolve(foundEntries[0]);
        } else {
          const name = (Array.isArray(pattern))
            ? pattern.join(' - ')
            : pattern;

          const stores = this.mStores.map(store => store.id).join(', ');
          return Promise.reject(new GameEntryNotFound(name, stores));
        }
      });
  }
}

const instance: GameStoreHelper = new GameStoreHelper();
export default instance;
