import { IExecInfo } from './IExecInfo';
import { ILauncherEntry } from './ILauncherEntry';

import * as Promise from 'bluebird';
import { ITool } from './ITool';

export class GameLauncherNotFound extends Error {
  private mName: string;
  constructor(name) {
    super('Missing game launcher extension');
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.mName = name;
  }

  public get launcherName() {
    return this.mName;
  }
}

export class GameNotFound extends Error {
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
 * @interface IGameStoreLauncher
 */
export interface IGameStoreLauncher extends ITool {
  /**
   * Designated for the game store launcher extension to
   *  configure itself and populate its game cache.
   */
  //setup: () => Promise<void>;

  /**
   * Returns all recognized/installed games which are currently
   *  installed with this game store/launcher.
   */
  allGames: () => Promise<ILauncherEntry[]>;

  /**
   * Given a game's name, function will try to find and,
   *  return the matching launcher entry for the game (if any)
   *
   * @param name The name of the game as it is stored within
   *  then game store's manifests/database.
   */
  findByName: (name: string | string[]) => Promise<ILauncherEntry>;

  /**
   * Game stores will usually assign an internal id/s to their games,
   *  attempt to match this id to any games we managed to identify.
   *
   * @param appId the game's app id as expected to be stored by the launcher.
   */
  findByAppId: (appId: string | string[]) => Promise<ILauncherEntry>;

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
   */
  launchGame: (appId: any) => Promise<void>;

  /**
   * Path to the game store launcher's extension.
   */
  extensionPath?: string;

  /**
   * The version of this extension.
   */
  version?: string;
}
