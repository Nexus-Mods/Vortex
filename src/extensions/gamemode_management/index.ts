import { showDialog } from '../../actions/notifications';
import {
  GameInfoQuery,
  IExtensionApi,
  IExtensionContext,
} from '../../types/IExtensionContext';
import {IGame} from '../../types/IGame';
import { IProfile, IState, IRunningTool } from '../../types/IState';
import { IEditChoice, ITableAttribute } from '../../types/ITableAttribute';
import {ProcessCanceled, SetupError, UserCanceled} from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import LazyComponent from '../../util/LazyComponent';
import local from '../../util/local';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import opn from '../../util/opn';
import ReduxProp from '../../util/ReduxProp';
import { activeGameId, activeProfile } from '../../util/selectors';
import { getSafe } from '../../util/storeHelper';
import { truthy } from '../../util/util';

import { setModType } from '../mod_management/actions/mods';
import { IModWithState } from '../mod_management/views/CheckModVersionsButton';
import { setNextProfile } from '../profile_management/actions/settings';

import { setGameInfo } from './actions/persistent';
import { addDiscoveredGame, addSearchPath,
         clearSearchPaths,
         setGamePath } from './actions/settings';
import { discoveryReducer } from './reducers/discovery';
import { persistentReducer } from './reducers/persistent';
import { sessionReducer } from './reducers/session';
import { settingsReducer } from './reducers/settings';
import { IDiscoveryResult } from './types/IDiscoveryResult';
import { IGameStored } from './types/IGameStored';
import { IModType } from './types/IModType';
import { getGame } from './util/getGame';
import { getModTypeExtensions, registerModType } from './util/modTypeExtensions';
import ProcessMonitor from './util/ProcessMonitor';
import queryGameInfo from './util/queryGameInfo';
import {} from './views/GamePicker';
import HideGameIcon from './views/HideGameIcon';
import ProgressFooter from './views/ProgressFooter';
import RecentlyManagedDashlet from './views/RecentlyManagedDashlet';
import {} from './views/Settings';

import GameModeManager from './GameModeManager';
import { currentGame, currentGameDiscovery } from './selectors';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import * as path from 'path';
import * as Redux from 'redux';
import * as semver from 'semver';

const extensionGames: IGame[] = [];

const $ = local<{
  gameModeManager: GameModeManager,
}>('gamemode-management', {
  gameModeManager: undefined,
});

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

  const now = Date.now();

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

function browseGameLocation(api: IExtensionApi, gameId: string): Promise<void> {
  const state: IState = api.store.getState();
  const game = getGame(gameId);
  const discovery = state.settings.gameMode.discovered[gameId];

  return new Promise<void>((resolve, reject) => {
    if ((discovery !== undefined) && (discovery.path !== undefined)) {
      remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
        properties: ['openDirectory'],
        defaultPath: discovery.path,
      }, (fileNames: string[]) => {
        if ((fileNames !== undefined) && truthy(fileNames[0])) {
          verifyGamePath(game, fileNames[0])
            .then(() => {
              api.store.dispatch(setGamePath(game.id, fileNames[0]));
              resolve();
            })
            .catch(err => {
              api.store.dispatch(showDialog('error', 'Game not found', {
                text: api.translate('This directory doesn\'t appear to contain the game.\n'
                          + 'Usually you need to select the top-level game directory, '
                          + 'containing the following files:\n{{ files }}',
                  { replace: { files: game.requiredFiles.join('\n') } }),
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
      remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
        properties: ['openDirectory'],
      }, (fileNames: string[]) => {
        if (fileNames !== undefined) {
          verifyGamePath(game, fileNames[0])
            .then(() => {
              const exe = game.executable(fileNames[0]);
              api.store.dispatch(addDiscoveredGame(game.id, {
                path: fileNames[0],
                tools: {},
                hidden: false,
                environment: game.environment,
                executable: (exe !== game.executable()) ? exe : undefined,
              }));
              resolve();
            })
            .catch(err => {
              api.store.dispatch(showDialog('error', 'Game not found', {
                text: api.translate('This directory doesn\'t appear to contain the game. '
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

function removeDisappearedGames(api: IExtensionApi): Promise<void> {
  const state: IState = api.store.getState();
  const discovered = state.settings.gameMode.discovered;
  const known = state.session.gameMode.known;
  const gameMode = activeGameId(state);

  return Promise.map(
    Object.keys(discovered).filter(gameId => discovered[gameId].path !== undefined),
    gameId => {
      const stored = known.find(iter => iter.id === gameId);
      return stored === undefined
        ? Promise.resolve()
        : Promise.map(stored.requiredFiles,
          file => fs.statAsync(path.join(discovered[gameId].path, file)))
          .then(() => undefined)
          .catch(err => {
            log('info', 'game no longer found', stored.name);
            api.sendNotification({
              type: 'info',
              message: api.translate('{{gameName}} no longer found',
                                     { replace: { gameName: stored.name } }),
            });

            if (gameId === gameMode) {
              api.store.dispatch(setNextProfile(undefined));
            }
            api.store.dispatch(setGamePath(gameId, undefined));
          });
    }).then(() => {
      const gameMode = activeGameId(state);
      if (known.find(game => game.id === gameMode) === undefined) {
        log('info', 'the active game is no longer known, resetting', gameMode);
        api.store.dispatch(setNextProfile(undefined));
      }
    });
}

function resetSearchPaths(api: IExtensionApi) {
  const store = api.store;

  store.dispatch(clearSearchPaths());

  let list;
  try {
    list = require('drivelist').list;
    if (typeof(list) !== 'function') {
      throw new Error('Failed to load "drivelist" module');
    }
  } catch (err) {
    api.showErrorNotification('Failed to query list of system drives',
      {
        message: 'Vortex was not able to query the operating system for the list of system drives. '
            + 'If this error persists, please configure the list manually.',
        error: err,
      }, { allowReport: false });
    return;
  }
  list()
    .then(disks => {
      for (const disk of disks.sort()) {
        // note: isRemovable is set correctly on windows, on MacOS (and presumably linux)
        // it will, as of this writing, be null. The isSystem flag should suffice as a
        // filter though.
        if (disk.isSystem && !disk.isRemovable) {
          if (disk.mountpoints) {
            disk.mountpoints.forEach(
                mp => { store.dispatch(addSearchPath(mp.path)); });
          } else {
            store.dispatch(addSearchPath(disk.mountpoint));
          }
        }
      }
    })
    .catch(err => {
      api.showErrorNotification(
          'Failed to determine list of disk drives. ' +
              'Please review the settings before scanning for games.',
          err, { allowReport: false });
      store.dispatch(addSearchPath('C:'));
    });
}

function genModTypeAttribute(api: IExtensionApi): ITableAttribute<IModWithState> {
  return {
    id: 'modType',
    name: 'Mod Type',
    description: 'Type of the mod (decides where it gets deployed to)',
    placement: 'detail',
    calc: mod => mod.type,
    help: 'The mod type controls where (and maybe even how) a mod gets deployed. '
      + 'Leave empty (default) unless you know what you\'re doing.',
    supportsMultiple: true,
    edit: {
      placeholder: () => api.translate('Default'),
      choices: () => {
        const gameMode = activeGameId(api.store.getState());
        return getModTypeExtensions()
          .filter((type: IModType) => type.isSupported(gameMode))
          .map((type: IModType): IEditChoice =>
            ({ key: type.typeId, text: (type.typeId || 'Default') }));
      },
      onChangeValue: (mods, newValue) => {
        const gameMode = activeGameId(api.store.getState());
        const setModId = (mod: IModWithState) => {
          api.store.dispatch(setModType(gameMode, mod.id, newValue || ''));
        };
        if (Array.isArray(mods)) {
          mods.forEach(setModId);
        } else {
          setModId(mods);
        }
      },
    },
  };
}

function init(context: IExtensionContext): boolean {
  const activity = new ReduxProp(context.api, [
    ['session', 'discovery'],
    ], (discovery: any) => discovery.running);

  context.registerMainPage('game', 'Games', LazyComponent(() => require('./views/GamePicker')), {
    hotkey: 'G',
    group: 'global',
    props: () => ({
      onRefreshGameInfo: (gameId: string) => refreshGameInfo(context.api.store, gameId),
      onBrowseGameLocation: (gameId: string) => browseGameLocation(context.api, gameId),
    }),
    activity,
  });
  context.registerSettings('Games', LazyComponent(() => require('./views/Settings')), () => ({
    onResetSearchPaths: () => resetSearchPaths(context.api),
  }));
  context.registerReducer(['session', 'discovery'], discoveryReducer);
  context.registerReducer(['session', 'gameMode'], sessionReducer);
  context.registerReducer(['settings', 'gameMode'], settingsReducer);
  context.registerReducer(['persistent', 'gameMode'], persistentReducer);
  context.registerFooter('discovery-progress', ProgressFooter);

  context.registerTableAttribute('mods', genModTypeAttribute(context.api));

  // TODO: hack, we need the extension path to get at the assets but this parameter
  //   is only added internally and not part of the public api
  context.registerGame = ((game: IGame, extensionPath: string) => {
    game.extensionPath = extensionPath;
    try {
      const gameExtInfo = JSON.parse(
        fs.readFileSync(path.join(extensionPath, 'info.json'), { encoding: 'utf8' }));
      game.contributed = (gameExtInfo.author === 'Black Tree Gaming Ltd.')
        ? undefined
        : gameExtInfo.author;
      game.final = semver.gte(gameExtInfo.version, '1.0.0');
      game.version = gameExtInfo.version;
      extensionGames.push(game);
    } catch (err) {
      context.api.showErrorNotification('Game Extension not loaded', err, {
        allowReport: false,
        message: game.name,
      });
    }
  }) as any;

  context.registerGameInfoProvider =
    (id: string, priority: number, expireMS: number, keys: string[], query: GameInfoQuery) => {
      gameInfoProviders.push({ id, priority, expireMS, keys, query });
  };

  context.registerModType = registerModType;

  context.registerGameInfoProvider('game-path', 0, 1000,
    ['path'], (game: IGame & IDiscoveryResult) => (game.path === undefined)
      ? Promise.resolve({})
      : Promise.resolve({
        path: { title: 'Path', value: path.normalize(game.path), type: 'url' },
      }));

  context.registerGameInfoProvider('main', 0, 86400000,
    ['size', 'size_nolinks'], queryGameInfo);

  const openGameFolder = (instanceIds: string[]) => {
    const discoveredGames = context.api.store.getState().settings.gameMode.discovered;
    const gamePath = getSafe(discoveredGames, [instanceIds[0], 'path'], undefined);
    if (gamePath !== undefined) {
      opn(gamePath).catch(() => undefined);
    }
  };

  const openModFolder = (instanceIds: string[]) => {
    const discoveredGames = context.api.store.getState().settings.gameMode.discovered;
    const discovered = getSafe(discoveredGames, [instanceIds[0]], undefined);
    if (discovered !== undefined) {
      try {
        opn(getGame(instanceIds[0]).getModPaths(discovered.path)[''])
          .catch(() => undefined);
      } catch (err) {
        log('warn', 'failed to open mod directory', err.message);
      }
    }
  };

  context.registerAction('game-icons', 100, 'refresh', {}, 'Scan: Quick', () => {
    if ($.gameModeManager !== undefined) {
      // we need the state from before the discovery so can determine which games were discovered
      const oldState: IState = context.api.store.getState();
      $.gameModeManager.startQuickDiscovery()
        .then((gameIds: string[]) => {
          const discoveredGames = oldState.settings.gameMode.discovered;
          const knownGames = oldState.session.gameMode.known;
          const newGames = gameIds.filter(id =>
            (discoveredGames[id] === undefined) || (discoveredGames[id].path === undefined));
          const message = newGames.length === 0
            ? 'No new games found'
            : newGames.map(id => '- ' + knownGames.find(iter => iter.id === id).name).join('\n');
          removeDisappearedGames(context.api);
          context.api.sendNotification({
            type: 'success',
            title: 'Discovery completed',
            message,
          });
        });
    }
  });

  context.registerAction('game-icons', 110, 'refresh', {}, 'Scan: Full', () => {
    if (($.gameModeManager !== undefined) && !$.gameModeManager.isSearching()) {
      try {
        $.gameModeManager.startSearchDiscovery();
      } catch (err) {
        context.api.showErrorNotification('Failed to search for games', err);
      }
    }
  });

  context.registerAction('game-managed-buttons', 100, HideGameIcon, {});
  context.registerAction('game-discovered-buttons', 100, HideGameIcon, {});
  context.registerAction('game-undiscovered-buttons', 100, HideGameIcon, {});
  context.registerAction('game-managed-buttons', 105, 'open-ext', {},
                         context.api.translate('Open Game Folder'),
                         openGameFolder);
  context.registerAction('game-discovered-buttons', 105, 'open-ext', {},
                         context.api.translate('Open Game Folder'),
                         openGameFolder);
  context.registerAction('game-managed-buttons', 110, 'open-ext', {},
                         context.api.translate('Open Mod Folder'),
                         openModFolder);
  context.registerAction('game-discovered-buttons', 110, 'open-ext', {},
                         context.api.translate('Open Mod Folder'),
                         openModFolder);
  context.registerAction('game-managed-buttons', 120, 'browse', {},
    context.api.translate('Manually Set Location'),
    (instanceIds: string[]) => { browseGameLocation(context.api, instanceIds[0]); });

  context.registerAction('game-discovered-buttons', 120, 'browse', {},
    context.api.translate('Manually Set Location'),
    (instanceIds: string[]) => { browseGameLocation(context.api, instanceIds[0]); });

  context.registerAction('game-undiscovered-buttons', 50, 'browse', {},
    context.api.translate('Manually Set Location'),
    (instanceIds: string[]) => { browseGameLocation(context.api, instanceIds[0]); });

  context.registerDashlet('Recently Managed', 2, 2, 175, RecentlyManagedDashlet,
                          undefined, undefined, undefined);

  context.once(() => {
    const store: Redux.Store<IState> = context.api.store;
    const events = context.api.events;

    const GameModeManagerImpl: typeof GameModeManager = require('./GameModeManager').default;
    $.gameModeManager = new GameModeManagerImpl(
      extensionGames,
      (gameMode: string) => {
        log('debug', 'gamemode activated', gameMode);
        events.emit('gamemode-activated', gameMode);
      });
    $.gameModeManager.attachToStore(store);
    $.gameModeManager.startQuickDiscovery()
    .then(() => removeDisappearedGames(context.api));

    events.on('start-quick-discovery', (cb?: (gameIds: string[]) => void) =>
      $.gameModeManager.startQuickDiscovery()
        .then((gameIds: string[]) => {
          return removeDisappearedGames(context.api)
            .then(() => {
              if (cb !== undefined) {
                cb(gameIds);
              }
            });
        }));
    events.on('start-discovery', () => {
      try {
        $.gameModeManager.startSearchDiscovery();
      } catch (err) {
        context.api.showErrorNotification('Failed to search for games', err);
      }
    });
    events.on('cancel-discovery', () => {
      log('info', 'received cancel discovery');
      $.gameModeManager.stopSearchDiscovery();
    });

    events.on('refresh-game-info', (gameId: string, callback: (err: Error) => void) => {
      refreshGameInfo(store, gameId)
      .then(() => callback(null))
      .catch(err => callback(err));
    });

    let { searchPaths } = store.getState().settings.gameMode;

    if ((searchPaths !== undefined) && Array.isArray(searchPaths[0])) {
      store.dispatch(clearSearchPaths());
      searchPaths = undefined;
    }

    if (searchPaths === undefined) {
      resetSearchPaths(context.api);
    }

    const changeGameMode = (oldGameId: string, newGameId: string,
                            currentProfileId: string): Promise<void> => {
      if (newGameId === undefined) {
        return Promise.resolve();
      }
      log('debug', 'change game mode', { oldGameId, newGameId });

      if (getGame(newGameId) === undefined) {
        return Promise.reject(new Error(`Attempt to switch to unknown game "${newGameId}"`));
      }

      const id = context.api.sendNotification({
        title: 'Preparing game for modding',
        message: getGame(newGameId).name,
        type: 'activity',
      })

      // Important: This happens after the profile has already been activated
      //   and while the ui is usable again so at this point the user can already
      //   switch the game/profile again. The code below has to be able to deal with that
      return $.gameModeManager.setupGameMode(newGameId)
        .then(() => $.gameModeManager.setGameMode(oldGameId, newGameId, currentProfileId))
        .catch((err) => {
          if (err instanceof UserCanceled) {
            // nop
          } else if ((err instanceof ProcessCanceled)
                    || (err instanceof SetupError)) {
            showError(store.dispatch, 'Failed to set game mode',
                      err.message, { allowReport: false, message: newGameId });
          } else {
            showError(store.dispatch, 'Failed to set game mode', err, {
              message: newGameId,
            });
          }
          // unset profile
          store.dispatch(setNextProfile(undefined));
        })
        .finally(() => {
          context.api.dismissNotification(id);
        });
    };

    context.api.onStateChange(['settings', 'profiles', 'activeProfileId'],
      (prev: string, current: string) => {
        const state = store.getState();
        const oldGameId = getSafe(state, ['persistent', 'profiles', prev, 'gameId'], undefined);
        const newGameId = getSafe(state, ['persistent', 'profiles', current, 'gameId'], undefined);
        log('debug', 'active profile id changed', { prev, current, oldGameId, newGameId });
        const prom = (oldGameId !== newGameId)
          ? changeGameMode(oldGameId, newGameId, current)
          : Promise.resolve();

        prom.then(() => {
          const game = {
              ...currentGame(state),
              ...currentGameDiscovery(state),
          };

          if ((oldGameId !== newGameId)
              && (game.name !== undefined)) {
            const t = context.api.translate;

            context.api.sendNotification({
              type: 'info',
              message: 'Switched game mode: {{mode}}',
              replace: {
                mode: game.name,
              },
              displayMS: 4000,
            });
          }
          return null;
        });
      });

    let processMonitor = new ProcessMonitor(context.api);
    type RunningMap = { [exePath: string]: IRunningTool };
    context.api.onStateChange(['session', 'base', 'toolsRunning'],
      (prev: RunningMap, current: RunningMap) => {
        const exePaths = Object.keys(current);
        if (exePaths.length > 0) {
          // no effect if it's already running
          processMonitor.start();
        } else {
          processMonitor.end();
        }
      });

    {
      const profile: IProfile = activeProfile(store.getState());
      if (profile !== undefined) {
        const gameMode = profile.gameId;
        const discovery = store.getState().settings.gameMode.discovered[gameMode];
        if ((discovery !== undefined)
            && (discovery.path !== undefined)
            && (getGame(gameMode) !== undefined)) {
          changeGameMode(undefined, gameMode, profile.id)
            .then(() => null);
        } else {
          // if the game is no longer discovered we can't keep this profile as active
          store.dispatch(setNextProfile(undefined));
        }
      }
    }
  });

  return true;
}

export default init;
