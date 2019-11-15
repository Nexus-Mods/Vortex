import * as Promise from 'bluebird';
import { GameEntryNotFound,
  GameLauncherNotFound, IGameStoreLauncher } from '../types/IGameStoreLauncher';
import { ILauncherEntry } from '../types/ILauncherEntry';
import { log } from '../util/log';

import EpicGamesLauncher from './EpicGamesLauncher';
import Steam, { GameNotFound } from './Steam';

import { getGameLaunchers } from '../extensions/gamemode_management/util/getGame';

type SearchType = 'name' | 'id';

class GameStoreHelper {
  private mLaunchers: IGameStoreLauncher[];

  // Search for a specific launcher.
  public getLauncher(launcherId: string): IGameStoreLauncher {
    return this.getLaunchers().find(launcher => launcher.id === launcherId);
  }

  // Returns the id of the first game store launcher that has
  //  an existing game entry for the game we're looking for.
  //  Will return undefined if no launcher has a matching game entry.
  // OR
  // If a launcher id is specified, it will return the provided
  //  launcher id if the game is installed using the specified launcher id;
  //  otherwise will return undefined.
  public isGameInstalled(id: string, launcherId?: string): Promise<string> {
    return ((launcherId !== undefined)
      ? this.findGameEntry('id', id, launcherId)
      : this.findGameEntry('id', id))
      .then(entry => entry.gameStoreId);
  }

  public findByName(name: string, launcherId?: string): Promise<ILauncherEntry> {
    return this.findGameEntry('name', name, launcherId)
      .catch(err => {
        const isGameMissing  = (err instanceof GameEntryNotFound);
        log(isGameMissing  ? 'debug' : 'error', 'launchers can\'t find game entry', err);
        return Promise.resolve(undefined);
      });
  }

  public findByAppId(appId: string | string[], launcherId?: string): Promise<ILauncherEntry> {
    return this.findGameEntry('id', appId, launcherId)
      .catch(err => {
        const isGameMissing  = (err instanceof GameEntryNotFound);
        log(isGameMissing  ? 'debug' : 'error', 'launchers can\'t find game entry', err);
        return Promise.resolve(undefined);
      });
  }

  private getLaunchers(): IGameStoreLauncher[] {
    if (!!this.mLaunchers) {
      return this.mLaunchers;
    }
    // It's possible that the game mode manager has yet
    //  to load the launchers.
    try {
      this.mLaunchers = [Steam, EpicGamesLauncher, ...getGameLaunchers()];
      return this.mLaunchers;
    } catch (err) {
      log('debug', 'launchers have yet to load', err);
      return [];
    }
  }

  /**
   * Returns a launcher entry for a specified pattern.
   * @param searchType dictates which functor we execute.
   * @param pattern the pattern we're looking for.
   * @param launcherId optional parameter used when trying to query a specific launcher.
   */
  private findGameEntry(searchType: SearchType,
                        pattern: string | string[],
                        launcherId?: string): Promise<ILauncherEntry> {
    let gameLauncher: IGameStoreLauncher;
    if (!!launcherId) {
      gameLauncher = this.getLaunchers().find(launcher => launcher.id === launcherId);
      return (gameLauncher === undefined)
        ? Promise.reject(new GameLauncherNotFound(launcherId))
        : (searchType === 'id')
          ? gameLauncher.findByAppId(pattern)
          : gameLauncher.findByName(pattern);
    }

    return new Promise((resolve, reject) =>
      Promise.each(this.getLaunchers(), launcher => ((searchType === 'id')
        ? launcher.findByAppId(pattern)
        : launcher.findByName(pattern))
          .then(entry => resolve(entry))
          .catch(GameEntryNotFound, () => Promise.resolve())
          .catch(GameNotFound, () => Promise.resolve()))
      .then(() => {
        // If we reached this point it means the loaded launchers
        //  have been unable to find a game entry for this game.
        const name = (Array.isArray(pattern))
          ? pattern.join(' - ')
          : pattern;

        const stores = this.mLaunchers.map(launcher => launcher.id).join(', ');
        return reject(new GameEntryNotFound(name, stores));
    }));
  }
}

const instance: GameStoreHelper = new GameStoreHelper();
export default instance;
