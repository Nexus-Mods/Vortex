import { addNotification, showDialog } from '../../actions/notifications';
import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { ThunkStore } from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import { IState } from '../../types/IState';
import { ITool } from '../../types/ITool';
import { getNormalizeFunc } from '../../util/api';
import { ProcessCanceled, UserCanceled } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import { log } from '../../util/log';
import { activeProfile } from '../../util/selectors';

import {
  discoveryFinished,
  discoveryProgress,
  setPhaseCount,
} from './actions/discovery';
import {setKnownGames} from './actions/session';
import { addDiscoveredGame, addDiscoveredTool } from './actions/settings';
import { IDiscoveryResult } from './types/IDiscoveryResult';
import { IGameStored } from './types/IGameStored';
import { IToolStored } from './types/IToolStored';
import { discoverRelativeTools, quickDiscovery, searchDiscovery } from './util/discovery';

import * as Promise from 'bluebird';
import * as path from 'path';
import * as Redux from 'redux';

/**
 * discovers game modes
 *
 * @class GameModeManager
 */
class GameModeManager {
  private mStore: ThunkStore<IState>;
  private mKnownGames: IGame[];
  private mActiveSearch: Promise<any[]>;
  private mOnGameModeActivated: (mode: string) => void;

  constructor(extensionGames: IGame[],
              onGameModeActivated: (mode: string) => void) {
    this.mStore = null;
    this.mKnownGames = extensionGames;
    this.mActiveSearch = null;
    this.mOnGameModeActivated = onGameModeActivated;
  }

  /**
   * attach this manager to the specified store
   *
   * @param {Redux.Store<IStateEx>} store
   *
   * @memberOf GameModeManager
   */
  public attachToStore(store: Redux.Store<IState>) {
    this.mStore = store;

    const gamesStored: IGameStored[] = this.mKnownGames.map(this.storeGame);
    store.dispatch(setKnownGames(gamesStored));
    // we used to activate the game mode right here but there is another
    // call to do this in the "once" CB of gamemode_management so it's
    // redundant and the other call handles errors properly while this one
    // didn't
  }

  /**
   * update the game mode being managed
   *
   * @param {string} newMode
   *
   * @memberOf GameModeManager
   */
  public setGameMode(oldMode: string, newMode: string, profileId): Promise<void> {
    log('debug', 'set game mode', { oldMode, newMode });
    const game = this.mKnownGames.find(knownGame => knownGame.id === newMode);
    const discoveredGames = this.mStore.getState().settings.gameMode.discovered;
    const gameDiscovery = discoveredGames[newMode];
    if ((game === undefined)
        || (gameDiscovery === undefined)
        || (gameDiscovery.path === undefined)) {
      // new game mode is not valid
      return Promise.reject(new ProcessCanceled('game mode not found'));
    }

    let modPath;
    try {
      modPath = game.queryModPath(gameDiscovery.path);
      if (!path.isAbsolute(modPath)) {
        modPath = path.resolve(gameDiscovery.path, modPath);
      }
    } catch (err) {
      return Promise.reject(err);
    }
    return fs.statAsync(gameDiscovery.path)
      .then(() => fs.statAsync(modPath))
      .then(() => this.ensureWritable(modPath))
      .then(() => getNormalizeFunc(gameDiscovery.path))
      .then(normalize =>
        discoverRelativeTools(game, gameDiscovery.path, discoveredGames,
                              this.onDiscoveredTool, normalize))
      .then(() => {
        const currentProfile = activeProfile(this.mStore.getState());
        if ((currentProfile !== undefined) && (profileId === currentProfile.id)) {
          log('info', 'changed game mode', {oldMode, newMode});
          this.mOnGameModeActivated(newMode);
        } else {
          log('info', 'game prepared but it\'s no longer active');
        }
      })
      .catch(err => {
        return (err.code === 'ENOENT')
        ? Promise.reject(new ProcessCanceled('Missing: ' + (err.filename || modPath)))
        : Promise.reject(err);
      });
  }

  /**
   * prepare change to a different game mode
   *
   * @param {string} gameMode
   * @returns {Promise<void>}
   *
   * @memberOf GameModeManager
   */
  public setupGameMode(gameMode: string): Promise<void> {
    const game = this.mKnownGames.find(knownGame => knownGame.id === gameMode);
    const gameDiscovery = this.mStore.getState().settings.gameMode.discovered[gameMode];

    log('debug', 'setup game mode', gameMode);
    if ((gameDiscovery === undefined) || (gameDiscovery.path === undefined)) {
      return Promise.reject(new Error('game not discovered'));
    } else if ((game === undefined) || (game.setup === undefined)) {
      return Promise.resolve();
    } else {
      try {
        return fs.statAsync(gameDiscovery.path)
          .then(() => game.setup(gameDiscovery))
          .catch(err => ((err.code === 'ENOENT') && (err.path === gameDiscovery.path))
            ? Promise.reject(new ProcessCanceled(
              `Game folder \"${gameDiscovery.path}\" doesn\'t exist (any more).`))
            : Promise.reject(err));
      } catch (err) {
        return Promise.reject(err);
      }
    }
  }

  public get games(): IGame[] {
    return this.mKnownGames;
  }

  /**
   * starts game discovery, only using the search function from the game
   * extension
   *
   * @memberOf GameModeManager
   */
  public startQuickDiscovery() {
    return quickDiscovery(this.mKnownGames, this.mStore.getState().settings.gameMode.discovered,
                          this.onDiscoveredGame, this.onDiscoveredTool);
  }

  public isSearching(): boolean {
    return this.mActiveSearch !== null;
  }

  /**
   * start game discovery using known files
   *
   * @memberOf GameModeManager
   */
  public startSearchDiscovery(): void {
    const progressCallback = (idx: number, percent: number, label: string) =>
            this.mStore.dispatch(discoveryProgress(idx, percent, label));

    const state: IState = this.mStore.getState();
    const { searchPaths } = state.settings.gameMode;

    if (!Array.isArray(searchPaths)) {
      throw new Error('invalid search paths: ' + require('util').inspect(searchPaths));
    }

    if (state.session.discovery.running) {
      // already scanning
      return;
    }

    this.mStore.dispatch(setPhaseCount(searchPaths.length));

    this.mActiveSearch = searchDiscovery(
      this.mKnownGames,
      state.settings.gameMode.discovered,
      searchPaths.slice().sort(),
      this.onDiscoveredGame,
      this.onDiscoveredTool,
      this.onError,
      progressCallback)
    .finally(() => {
      this.mStore.dispatch(discoveryFinished());
      this.mActiveSearch = null;
    });
  }

  /**
   * stop search discovery
   *
   * @memberOf GameModeManager
   */
  public stopSearchDiscovery(): void {
    log('info', 'stop search', { prom: this.mActiveSearch });
    if (this.mActiveSearch !== null) {
      this.mActiveSearch.cancel();
      this.mActiveSearch = null;
    }
  }

  private ensureWritable(modPath: string): Promise<void> {
    return fs.ensureDirWritableAsync(modPath, () => new Promise<void>((resolve, reject) => {
      this.mStore.dispatch(showDialog('question', 'Access Denied', {
        text: 'The mod directory for this game is not writable to your user account.\n'
            + 'If you have admin rights on this system, Vortex can change the permissions '
            + 'to allow it write access.',
      }, [
        { label: 'Cancel', action: () => reject(new UserCanceled()) },
        { label: 'Allow access', action: () => resolve() },
      ]));
    }));
  }

  private storeGame = (game: IGame): IGameStored => {
    return {
      name: game.name,
      shortName: game.shortName,
      id: game.id,
      logo: game.logo,
      extensionPath: game.extensionPath,
      parameters: game.parameters || [],
      requiredFiles: game.requiredFiles,
      supportedTools: game.supportedTools !== undefined
        ? game.supportedTools.map(this.storeTool)
        : [],
      executable: game.executable(),
      environment: game.environment,
      details: game.details,
      shell: game.shell,
      contributed: game.contributed,
      final: game.final,
    };
  }

  private storeTool(tool: ITool): IToolStored {
    return {
      id: tool.id,
      name: tool.name,
      shortName: tool.shortName,
      logo: tool.logo,
      executable: tool.executable(),
      parameters: tool.parameters || [],
      environment: tool.environment,
      exclusive: tool.exclusive,
    };
  }

  private onDiscoveredTool = (gameId: string, result: IDiscoveredTool) => {
    this.mStore.dispatch(addDiscoveredTool(gameId, result.id, result));
  }

  private onDiscoveredGame = (gameId: string, result: IDiscoveryResult) => {
    this.mStore.dispatch(addDiscoveredGame(gameId, result));
  }

  private onError = (title: string, message: string) => {
    this.mStore.dispatch(addNotification({
      type: 'error',
      message,
      title,
    }));
  }
}

export default GameModeManager;
