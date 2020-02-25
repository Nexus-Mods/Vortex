import Promise from 'bluebird';
import { GameEntryNotFound, GameStoreNotFound,
  IGameStore, IGameStoreEntry } from '../types/api';
import { log } from '../util/log';

import EpicGamesLauncher from './EpicGamesLauncher';
import Steam, { GameNotFound } from './Steam';

import { getGameStores } from '../extensions/gamemode_management/util/getGame';

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
    return this.findGameEntry('name', name, storeId)
      .catch(err => {
        const isGameMissing  = ((err instanceof GameEntryNotFound)
                             || (err instanceof GameNotFound));
        if (!isGameMissing) {
          log('error', 'stores can\'t find game entry', err);
        }
        return Promise.resolve(undefined);
      });
  }

  public findByAppId(appId: string | string[], storeId?: string): Promise<IGameStoreEntry> {
    return this.findGameEntry('id', appId, storeId)
      .catch(err => {
        const isGameMissing  = ((err instanceof GameEntryNotFound)
                             || (err instanceof GameNotFound));
        if (!isGameMissing) {
          log('error', 'stores can\'t find game entry', err);
        }
        return Promise.resolve(undefined);
      });
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

    // For obvious reasons, this should only be used for
    //  name searchTypes; using this for id's would potentially
    // cause false positives.
    const rgxMatcher = (Array.isArray(pattern))
      ? new RegExp(pattern.join('|'))
      : new RegExp(pattern);

    const matcher = Array.isArray(pattern)
      ? entry => pattern.indexOf(entryInfo(entry)) !== -1
      : entry => entryInfo(entry) === pattern;

    const gameStores = (!!storeId) ? [this.getGameStore(storeId)] : this.getstores();

    let foundEntry: boolean = false;
    return new Promise((resolve, reject) =>
      Promise.each(gameStores, store => {
        if (foundEntry) {
          // We already found the entry, no point
          //  to continue.
          return Promise.resolve();
        }

        return (!store)
          ? Promise.reject(new GameStoreNotFound(storeId))
          : store.allGames()
            .then(entries => {
              const entry = (searchType === 'id')
                ? entries.find(matcher) : entries.find(ent => rgxMatcher.test(ent.name));
              foundEntry = (!!entry);

              const errMessage = (Array.isArray(pattern)) ? pattern.join(';') : pattern;
              return (entry === undefined)
                ? Promise.reject(new GameEntryNotFound(errMessage, store.id))
                : Promise.resolve(entry);
            })
            .then(entry => resolve(entry))
            .catch(GameEntryNotFound, () => Promise.resolve())
            .catch(GameNotFound, () => Promise.resolve());
      })
      .then(() => {
        // If we reached this point it means the loaded stores
        //  have been unable to find a game entry for this game.
        const name = (Array.isArray(pattern))
          ? pattern.join(' - ')
          : pattern;

        const stores = this.mStores.map(store => store.id).join(', ');
        return reject(new GameEntryNotFound(name, stores));
    })
    .catch(GameStoreNotFound, err => {
      log('error', 'could not find game store', err);
      return Promise.resolve();
    }));
  }
}

const instance: GameStoreHelper = new GameStoreHelper();
export default instance;
