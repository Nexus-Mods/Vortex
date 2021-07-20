import { addNotification, showDialog } from '../../actions/notifications';
import { IDiscoveredTool } from '../../types/IDiscoveredTool';
import { ThunkStore } from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import { IGameStore } from '../../types/IGameStore';
import { IState } from '../../types/IState';
import { ITool } from '../../types/ITool';
import { getNormalizeFunc } from '../../util/api';
import { ProcessCanceled, SetupError, UserCanceled } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import GameStoreHelper from '../../util/GameStoreHelper';
import { log } from '../../util/log';
import { activeProfile, discoveryByGame } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { truthy } from '../../util/util';

import { IExtensionDownloadInfo } from '../extension_manager/types';
import { setPrimaryTool } from '../starter_dashlet/actions';

import {
  discoveryFinished,
  discoveryProgress,
  setPhaseCount,
} from './actions/discovery';
import {clearGameDisabled, setGameDisabled, setKnownGames} from './actions/session';
import { addDiscoveredGame, addDiscoveredTool } from './actions/settings';
import { IDiscoveryResult } from './types/IDiscoveryResult';
import { IGameStored } from './types/IGameStored';
import { IToolStored } from './types/IToolStored';
import { discoverRelativeTools, quickDiscovery, quickDiscoveryTools, searchDiscovery } from './util/discovery';
import { getGame } from './util/getGame';

import Promise from 'bluebird';
import * as _ from 'lodash';
import * as path from 'path';
import * as Redux from 'redux';

export interface IGameStub {
  ext: IExtensionDownloadInfo;
  game: IGame;
}

/**
 * discovers game modes
 *
 * @class GameModeManager
 */
class GameModeManager {
  private mStore: ThunkStore<IState>;
  private mKnownGames: IGame[];
  private mGameStubs: IGameStub[];
  private mKnownGameStores: IGameStore[];
  private mActiveSearch: Promise<void>;
  private mOnGameModeActivated: (mode: string) => void;

  constructor(extensionGames: IGame[],
              gameStubs: IGameStub[],
              gameStoreExtensions: IGameStore[],
              onGameModeActivated: (mode: string) => void) {
    this.mStore = null;
    this.mKnownGames = extensionGames;
    this.mGameStubs = gameStubs;
    this.mKnownGameStores = gameStoreExtensions;
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
    if ((game === undefined) || (gameDiscovery?.path === undefined)) {
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
        const state = this.mStore.getState();
        const currentProfile = activeProfile(state);
        if ((currentProfile !== undefined) && (profileId === currentProfile.id)) {
          log('info', 'changed game mode', {oldMode, newMode});
          this.mOnGameModeActivated(newMode);
          const { gameId } = currentProfile;
          if (getSafe(state, ['settings', 'interface', 'primaryTool', gameId],
                      undefined) === undefined) {
            const discovery = discoveryByGame(state, gameId);
            if (truthy(discovery.tools)) {
              const defaultPrimary = Object.keys(discovery.tools)
                .find(toolId => discovery.tools[toolId].defaultPrimary === true);
              if (defaultPrimary !== undefined) {
                this.mStore.dispatch(setPrimaryTool(gameId, defaultPrimary));
              }
            }
          }
        } else {
          log('info', 'game prepared but it\'s no longer active');
        }
      })
      .catch(err => {
        return ['ENOENT', 'ENOTFOUND'].includes(err.code)
        ? Promise.reject(new SetupError('Missing: ' + (err.filename || modPath)))
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

  public get stubs(): IGameStub[] {
    return this.mGameStubs;
  }

  public get gameStores(): IGameStore[] {
    return this.mKnownGameStores;
  }

  /**
   * starts game discovery, only using the search function from the game
   * extension
   *
   * @memberOf GameModeManager
   */
  public startQuickDiscovery() {
    return this.reloadStoreGames()
      .then(() => quickDiscovery(this.mKnownGames,
        this.mStore.getState().settings.gameMode.discovered,
        this.onDiscoveredGame, this.onDiscoveredTool))
      .tap(() => this.postDiscovery())
      ;
  }

  public startToolDiscovery(gameId: string) {
    const game = this.mKnownGames.find(iter => iter.id === gameId);
    if (game !== undefined) {
      return quickDiscoveryTools(gameId, game.supportedTools, this.onDiscoveredTool);
    } else {
      return Promise.reject(new Error('unknown game id: ' + gameId));
    }
  }

  public isSearching(): boolean {
    return this.mActiveSearch !== null;
  }

  /**
   * start game discovery using known files
   *
   * @memberOf GameModeManager
   */
  public startSearchDiscovery(searchPaths: string[]): void {
    const progressCallback = (idx: number, percent: number, label: string) =>
            this.mStore.dispatch(discoveryProgress(idx, percent || 0, label));

    const state: IState = this.mStore.getState();

    if (!Array.isArray(searchPaths)) {
      throw new Error('invalid search paths: ' + require('util').inspect(searchPaths));
    }

    if (state.session.discovery.running) {
      // already scanning
      return;
    }

    this.mStore.dispatch(setPhaseCount(searchPaths.length));

    let numDiscovered = 0;
    const onDiscoveredGame = (gameId: string, result: IDiscoveryResult) => {
      ++numDiscovered;
      this.onDiscoveredGame(gameId, result);
    };

    const { discovered } = state.settings.gameMode;

    this.mActiveSearch = searchDiscovery(
      this.mKnownGames,
      discovered,
      searchPaths.slice().sort(),
      onDiscoveredGame,
      this.onDiscoveredTool,
      this.onError,
      progressCallback)
    .then((directoriesRead: number) => {
      this.mStore.dispatch(addNotification({
        type: 'success',
        title: 'Search finished',
        message: '{{searched}} directories were searched, {{numTotal}} games found ({{numDiscovered}} new)',
        replace: {
          searched: directoriesRead,
          numDiscovered,
          numTotal: Object.values(discovered).filter(iter => iter.path !== undefined).length,
        },
        displayMS: 10000,
      }));

    })
    .finally(() => {
      this.mStore.dispatch(discoveryFinished());
      this.mActiveSearch = null;
      return this.postDiscovery();
    });
  }

  /**
   * stop search discovery
   *
   * @memberOf GameModeManager
   */
  public stopSearchDiscovery(): void {
    log('info', 'stop search');
    if (this.mActiveSearch !== null) {
      this.mActiveSearch.cancel();
      this.mActiveSearch = null;
    }
  }

  private postDiscovery() {
    const { discovered } = this.mStore.getState().settings.gameMode;
    this.mStore.dispatch(clearGameDisabled());
    Promise.map(Object.keys(discovered), gameId => {
      if (discovered[gameId].path === undefined) {
        return Promise.resolve();
      }

      return getNormalizeFunc(discovered[gameId].path)
        .then(normalize => {
          const discovery = discovered[gameId];
          const game = getGame(gameId);
          // game may be uninstalled here so game being undefined is fine
          if (game?.overrides !== undefined) {
            game.overrides.forEach(override => {
              if ((discovered[override]?.path !== undefined)
                && (normalize(discovered[override].path) === normalize(discovery.path))) {
                this.mStore.dispatch(setGameDisabled(override, gameId));
              }
            });
          }
        });
    });
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

  private reloadStoreGames() {
    return GameStoreHelper.reloadGames();
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
    const SKIPPED_TOOL_ATTRIBUTES = [
      'id', 'name', 'logo',
      'executable', 'queryPath', 'parameters', 'requiredFiles',
      'relative',
    ];

    return {
      ..._.omit(tool, SKIPPED_TOOL_ATTRIBUTES),
      id: tool.id || 'MISSING_ID',
      name: tool.name || 'MISSING_NAME',
      logo: tool.logo || 'MISSING_LOGO',
      parameters: tool.parameters || [],
      environment: tool.environment || {},
      executable: tool.executable(),
    };
  }

  private onDiscoveredTool = (gameId: string, result: IDiscoveredTool) => {
    const existing = getSafe(this.mStore.getState(),
                             ['settings', 'gameMode', 'discovered', gameId, 'tools', result.id],
                             undefined);
    // don't overwrite customised tools
    if ((existing === undefined) || !existing.custom) {
      delete result.executable;
      this.mStore.dispatch(addDiscoveredTool(gameId, result.id, result, false));
    }
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
