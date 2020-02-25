import { IExecInfo } from './IExecInfo';
import { IExtensionApi } from './IExtensionContext';
import { IGameStoreEntry } from './IGameStoreEntry';

import Promise from 'bluebird';

export class GameStoreNotFound extends Error {
  private mName: string;
  constructor(name) {
    super('Missing game store extension');
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.mName = name;
  }

  public get storeName() {
    return this.mName;
  }
}

export class GameEntryNotFound extends Error {
  private mName: string;
  private mStore: string;
  private mExistingNames: string[];
  constructor(name: string, store: string, existing?: string[]) {
    super('Game entry not found');
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.mName = name;
    this.mStore = store;
    this.mExistingNames = existing;
  }

  // Returns the name of the game we couldn't find.
  public get gameName() {
    return this.mName;
  }

  // Name/Id of the store that couldn't find the game.
  public get storeName() {
    return this.mStore;
  }

  // Returns the name of the games we had confirmed exist
  //  in this game store.
  public get existingGames() {
    return this.mExistingNames;
  }
}

/**
 * interface for game store launcher extensions
 *
 * @interface IGameStore
 */
export interface IGameStore  {
  /**
   * This launcher's id.
   */
  id: string;

  /**
   * Returns all recognized/installed games which are currently
   *  installed with this game store/launcher.
   */
  allGames: () => Promise<IGameStoreEntry[]>;

  /**
   * Determine whether the game has been installed by this game store launcher.
   *  returns true if the game store installed this game, false otherwise.
   *
   * @param name of the game we're looking for.
   */
  isGameInstalled?: (name: string) => Promise<boolean>;

  /**
   * Some launchers may support Posix paths when attempting to launch a
   *  game, if set, the launcher will be expected to generate a valid
   *  posix path which Vortex can use to start the game.
   *
   * Please note that Vortex will not be able to tell if the game
   *  actually launched successfully when using Posix Paths; reason
   *  why this should only be used as a last resort.
   *
   * @param name of the game we want the posix path for.
   */
  getPosixPath?: (name: string) => Promise<string>;

  /**
   * Game store may support command line arguments when launching the game.
   *  Function will return the path to the game store's executable and any required
   *  arguments to launch the game.
   *
   * @param appId - Whatever the game store uses to identify a game.
   */
  getExecInfo?: (appId: any) => Promise<IExecInfo>;

  /**
   * Launches the game using this game launcher.
   * @param appId whatever the game store uses to identify a game.
   * @param api gives access to API functions if needed.
   */
  launchGame: (appId: any, api?: IExtensionApi) => Promise<void>;
}
