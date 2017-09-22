import { showDialog } from '../../actions/notifications';
import {
  GameInfoQuery,
  IExtensionApi,
  IExtensionContext,
  IInstruction,
} from '../../types/IExtensionContext';
import {IGame} from '../../types/IGame';
import { IState } from '../../types/IState';
import {ProcessCanceled} from '../../util/CustomErrors';
import LazyComponent from '../../util/LazyComponent';
import local from '../../util/local';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import ReduxProp from '../../util/ReduxProp';
import { activeGameId } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';

import {IDownload} from '../download_management/types/IDownload';
import { setNextProfile } from '../profile_management/actions/settings';

import { setGameInfo } from './actions/persistent';
import { addDiscoveredGame, addSearchPath, setGamePath } from './actions/settings';
import { discoveryReducer } from './reducers/discovery';
import { persistentReducer } from './reducers/persistent';
import { sessionReducer } from './reducers/session';
import { settingsReducer } from './reducers/settings';
import { IDiscoveryResult } from './types/IDiscoveryResult';
import { IGameStored } from './types/IGameStored';
import { IModType } from './types/IModType';
import queryGameInfo from './util/queryGameInfo';
import Dashlet from './views/Dashlet';
import {} from './views/GamePicker';
import HideGameIcon from './views/HideGameIcon';
import ProgressFooter from './views/ProgressFooter';
import {} from './views/Settings';

import GameModeManager from './GameModeManager';
import { currentGame, currentGameDiscovery } from './selectors';

import * as Promise from 'bluebird';
import { remote, shell } from 'electron';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as Redux from 'redux';

const extensionGames: IGame[] = [];
const modTypeExtensions: IModType[] = [];

// "decorate" IGame objects with added functionality
const gameExHandler = {
  get: (target: IGame, key: PropertyKey) => {
    if (key === 'getModPaths') {
      const applicableExtensions = modTypeExtensions.filter(ex => ex.isSupported(target.id));
      const extTypes = applicableExtensions.reduce((prev, val) => {
        prev[val.typeId] = val.getPath(target);
        return prev;
      }, {});

      return gamePath => {
        let defaultPath = target.queryModPath(gamePath);
        if (!path.isAbsolute(defaultPath)) {
          defaultPath = path.resolve(gamePath, defaultPath);
        }
        return {
          ...extTypes,
          '': defaultPath,
        };
      };
    } else if (key === 'modTypes') {
      const applicableExtensions = modTypeExtensions.filter(ex => ex.isSupported(target.id));
      return applicableExtensions;
    } else {
      return target[key];
    }
  },
};

function makeGameProxy(game: IGame): IGame {
  if (game === undefined) {
    return undefined;
  }
  return new Proxy(game, gameExHandler);
}

// this isn't nice...
const $ = local<{
  gameModeManager: GameModeManager,
}>('gamemode-management', {
  gameModeManager: undefined,
});

// ...neither is this
export function getGames(): IGame[] {
  if ($.gameModeManager === undefined) {
    throw new Error('getGames only available in renderer process');
  }
  return $.gameModeManager.games.map(makeGameProxy);
}

export function getGame(gameId: string): IGame {
  if ($.gameModeManager === undefined) {
    throw new Error('getGame only available in renderer process');
  }
  return makeGameProxy($.gameModeManager.games.find(iter => iter.id === gameId));
}

interface IProvider {
  id: string;
  priority: number;
  expireMS: number;
  keys: string[];
  query: GameInfoQuery;
}

const gameInfoProviders: IProvider[] = [];

function refreshGameInfo(store: Redux.Store<IState>, gameId: string): Promise<void> {
  interface IKeyProvider {
    [key: string]: { priority: number, provider: string };
  }

  // determine a dictionary of which keys we should have for the game
  const expectedKeys = gameInfoProviders.reduce((prev: IKeyProvider, value: IProvider) => {
    value.keys.forEach(key => {
      if ((prev[key] === undefined) || (prev[key].priority < value.priority)) {
        prev[key] = {
          priority: value.priority,
          provider: value.id,
        };
      }
    });
    return prev;
  }, {});

  const gameInfo = store.getState().persistent.gameMode.gameInfo[gameId] || {};

  const now = new Date().getTime();

  // find keys we need to update and which providers we have to query for that
  const missingKeys = Object.keys(expectedKeys).filter(key =>
    (gameInfo[key] === undefined) || (gameInfo[key].expires < now));
  const providersToQuery = Array.from(new Set(missingKeys.map(key =>
    gameInfoProviders.find(prov => prov.id === expectedKeys[key].provider))));

  // do the queries
  const game: IGameStored =
    store.getState().session.gameMode.known.find(iter => iter.id === gameId);
  const gameDiscovery: IDiscoveryResult =
    store.getState().settings.gameMode.discovered[gameId];

  const filterResult = (key: string, provider: IProvider) => {
    if (expectedKeys[key] !== undefined) {
      return getSafe(expectedKeys, [key, 'provider'], undefined) === provider.id;
    } else {
      // for unexpected keys, use the result if the key wasn't provided before or
      // if this provider has higher priority
      const provId = getSafe(gameInfo, [key, 'provider'], provider.id);
      const previousProvider = gameInfoProviders.find(prov => prov.id === provId);
      return previousProvider.priority <= provider.priority;
    }
  };

  return Promise.map(providersToQuery, prov => {
    const expires = now + prov.expireMS;
    return prov.query({ ...game, ...gameDiscovery }).then(details => {
      const receivedKeys = Object.keys(details);
      const values = receivedKeys
                         // TODO: this filters out "optional" info keys that
                         // weren't expected
                         .filter(key => filterResult(key, prov))
                         .map(key => ({
                                key,
                                title: details[key].title,
                                value: details[key].value,
                                type: details[key].type,
                              }));
      prov.keys.forEach(key => {
        if (receivedKeys.indexOf(key) === -1) {
          values.push({ key, title: 'Unknown', value: null, type: undefined });
        }
      });
      if (values.length > 0) {
        store.dispatch(setGameInfo(gameId, prov.id, expires, values));
      }
    });
  })
  .then(() => undefined);
}

function verifyGamePath(game: IGame, gamePath: string): Promise<void> {
  return Promise.map(game.requiredFiles || [], file =>
    fs.statAsync(path.join(gamePath, file)))
    .then(() => undefined);
}

function transformModPaths(basePath: string, input: { [type: string]: string }):
    { [type: string]: string } {
  return Object.keys(input).reduce((prev, type) => {
    if (input[type] !== undefined) {
      prev[type] = (path.isAbsolute(input[type]))
        ? input[type]
        : path.resolve(basePath, input[type]);
    }
    return prev;
  }, {});
}

function browseGameLocation(api: IExtensionApi, gameId: string): Promise<void> {
  const state: IState = api.store.getState();
  const game = $.gameModeManager.games.find(iter => iter.id === gameId);
  const discovery = state.settings.gameMode.discovered[gameId];

  return new Promise<void>((resolve, reject) => {
    if (discovery !== undefined) {
      remote.dialog.showOpenDialog(null, {
        properties: ['openDirectory'],
        defaultPath: discovery.path,
      }, (fileNames: string[]) => {
        if (fileNames !== undefined) {
          verifyGamePath(game, fileNames[0])
            .then(() => {
              api.store.dispatch(setGamePath(game.id, fileNames[0]));
              resolve();
            })
            .catch(err => {
              api.store.dispatch(showDialog('error', 'Game not found', {
                message: api.translate('This directory doesn\'t appear to contain the game. '
                  + 'Expected to find these files: {{ files }}',
                  { replace: { files: game.requiredFiles.join(', ') } }),
              }, [
                  { label: 'Cancel', action: () => resolve() },
                  { label: 'Try Again',
                    action: () => browseGameLocation(api, gameId).then(() => resolve()) },
                ]));
            });
        } else {
          resolve();
        }
      });
    } else {
      remote.dialog.showOpenDialog(null, {
        properties: ['openDirectory'],
      }, (fileNames: string[]) => {
        if (fileNames !== undefined) {
          verifyGamePath(game, fileNames[0])
            .then(() => {
              api.store.dispatch(addDiscoveredGame(game.id, {
                path: fileNames[0],
                tools: {},
                hidden: false,
                environment: game.environment,
              }));
              resolve();
            })
            .catch(err => {
              api.store.dispatch(showDialog('error', 'Game not found', {
                message: api.translate('This directory doesn\'t appear to contain the game. '
                  + 'Expected to find these files: {{ files }}',
                  { replace: { files: game.requiredFiles.join(', ') } }),
              }, [
                  { label: 'Cancel', action: () => resolve() },
                  { label: 'Try Again',
                    action: () => browseGameLocation(api, gameId).then(() => resolve()) },
                ]));
            });
        } else {
          resolve();
        }
      });
    }
  });
}

function init(context: IExtensionContext): boolean {
  const activity = new ReduxProp(context.api, [
    ['session', 'discovery'],
    ], (discovery: any) => discovery.running);

  context.registerMainPage('controller', 'Games', LazyComponent('./views/GamePicker', __dirname), {
    hotkey: 'G',
    group: 'global',
    props: () => ({
      onRefreshGameInfo: (gameId: string) => refreshGameInfo(context.api.store, gameId),
      onBrowseGameLocation: (gameId: string) => browseGameLocation(context.api, gameId),
    }),
    activity,
  });
  context.registerSettings('Games', LazyComponent('./views/Settings', __dirname));
  context.registerReducer(['session', 'discovery'], discoveryReducer);
  context.registerReducer(['session', 'gameMode'], sessionReducer);
  context.registerReducer(['settings', 'gameMode'], settingsReducer);
  context.registerReducer(['persistent', 'gameMode'], persistentReducer);
  context.registerFooter('discovery-progress', ProgressFooter);

  context.registerGame = (game: IGame, extensionPath: string) => {
    game.extensionPath = extensionPath;
    extensionGames.push(game);
  };

  context.registerGameInfoProvider =
    (id: string, priority: number, expireMS: number, keys: string[], query: GameInfoQuery) => {
      gameInfoProviders.push({ id, priority, expireMS, keys, query });
  };

  context.registerModType = (id: string, priority: number,
                             isSupported: (gameId: string) => boolean,
                             getPath: (game: IGame) => string,
                             test: (instructions: IInstruction[]) =>
                                 Promise<boolean>) => {
    modTypeExtensions.push({
      typeId: id,
      priority,
      isSupported,
      getPath,
      test,
    });
  };

  context.registerGameInfoProvider('main', 0, 86400000,
    ['path', 'size', 'size_nolinks'], queryGameInfo);

  const openGameFolder = (instanceIds: string[]) => {
    const discoveredGames = context.api.store.getState().settings.gameMode.discovered;
    const gamePath = getSafe(discoveredGames, [instanceIds[0], 'path'], undefined);
    if (gamePath !== undefined) {
      shell.openItem(gamePath);
    }
  };

  const openModFolder = (instanceIds: string[]) => {
    const discoveredGames = context.api.store.getState().settings.gameMode.discovered;
    const modPath = getSafe(discoveredGames, [instanceIds[0], 'modPath'], undefined);
    if (modPath !== undefined) {
      shell.openItem(modPath);
    }
  };

  context.registerAction('game-icons', 100, 'refresh', {}, 'Quickscan', () => {
    if ($.gameModeManager !== undefined) {
      $.gameModeManager.startQuickDiscovery()
      .then((gameNames: string[]) => {
        const message = gameNames.length === 0
          ? 'No new games found'
          : gameNames.map(name => '- ' + name).join('\n');
        context.api.sendNotification({
          type: 'success',
          message: 'Discovery completed\n' + message,
        });
      });
    }
  });

  context.registerAction('game-managed-buttons', 100, HideGameIcon, {});
  context.registerAction('game-discovered-buttons', 100, HideGameIcon, {});
  context.registerAction('game-undiscovered-buttons', 100, HideGameIcon, {});
  context.registerAction('game-managed-buttons', 105, 'folder', {},
                         context.api.translate('Open Game Folder'),
                         openGameFolder);
  context.registerAction('game-discovered-buttons', 105, 'folder', {},
                         context.api.translate('Open Game Folder'),
                         openGameFolder);
  context.registerAction('game-managed-buttons', 110, 'folder-gallery', {},
                         context.api.translate('Open Mod Folder'),
                         openModFolder);
  context.registerAction('game-discovered-buttons', 110, 'folder-gallery', {},
                         context.api.translate('Open Mod Folder'),
                         openModFolder);
  context.registerAction('game-undiscovered-buttons', 115, 'folder-open', {},
    context.api.translate('Manually Set Location'),
    (instanceIds: string[]) => { browseGameLocation(context.api, instanceIds[0]); });

  context.registerDashlet('Game Picker', 2, 2, 0, Dashlet, () =>
    activeGameId(context.api.store.getState()) === undefined);

  context.once(() => {
    const store: Redux.Store<IState> = context.api.store;
    const events = context.api.events;

    const GameModeManagerImpl: typeof GameModeManager = require('./GameModeManager').default;
    $.gameModeManager = new GameModeManagerImpl(
      context.api.getPath('userData'),
      extensionGames,
      (gameMode: string) => {
        events.emit('gamemode-activated', gameMode);
      });
    $.gameModeManager.attachToStore(store);
    $.gameModeManager.startQuickDiscovery();

    events.on('start-discovery', () => $.gameModeManager.startSearchDiscovery());
    events.on('cancel-discovery', () => {
      log('info', 'received cancel discovery');
      $.gameModeManager.stopSearchDiscovery();
    });

    events.on('refresh-game-info', (gameId: string, callback: (err: Error) => void) => {
      refreshGameInfo(store, gameId)
      .then(() => callback(null))
      .catch(err => callback(err));
    });

    if (store.getState().settings.gameMode.searchPaths === undefined) {
      const {list} = require('drivelist');
      list((error, disks) => {
        if (error) {
          context.api.showErrorNotification('Failed to determine list of disk drives. ' +
            'Please review the settings before scanning for games.',
            error);
          store.dispatch(addSearchPath(['C:']));
          return;
        }
        for (const disk of disks.sort()) {
          // 'system' drives are the non-removable ones
          if (disk.system) {
            if (disk.mountpoints) {
              disk.mountpoints.forEach(mp => store.dispatch(addSearchPath(mp.path)));
            } else {
              store.dispatch(addSearchPath(disk.mountpoint));
            }
          }
        }
      });
    }

    const changeGameMode = (oldGameId: string, newGameId: string,
                            oldProfileId: string): Promise<void> => {
      if (newGameId === undefined) {
        return Promise.resolve();
      }

      return $.gameModeManager.setupGameMode(newGameId)
        .then(() => $.gameModeManager.setGameMode(oldGameId, newGameId))
        .catch((err) => {
          if (err instanceof ProcessCanceled) {
            showError(store.dispatch, 'Failed to set game mode',
                      err.message, false, undefined, false);
          } else {
            showError(store.dispatch, 'Failed to set game mode', err);
          }
          // unset profile
          return store.dispatch(setNextProfile(undefined));
        });
    };

    context.api.onStateChange(['settings', 'profiles', 'activeProfileId'],
      (prev: string, current: string) => {
        const state = store.getState();
        const oldGameId = getSafe(state, ['persistent', 'profiles', prev, 'gameId'], undefined);
        const newGameId = getSafe(state, ['persistent', 'profiles', current, 'gameId'], undefined);
        log('debug', 'active profile id changed', { prev, current, oldGameId, newGameId });
        const prom = (oldGameId !== newGameId)
          ? changeGameMode(oldGameId, newGameId, prev)
          : Promise.resolve();

        prom.then(() => {
          const game = {
              ...currentGame(state),
              ...currentGameDiscovery(state),
          };

          if (game.name === undefined) {
            return null;
          }

          const t = context.api.translate;

          context.api.sendNotification({
            type: 'info',
            message: t('Switched game mode: {{mode}}',
                       {
                         replace: {
                           mode: game.name,
                         },
                       }),
            displayMS: 4000,
          });
          return null;
        });
      });

    changeGameMode(undefined, activeGameId(store.getState()), undefined)
    .then(() => null);
  });

  return true;
}

export default init;
