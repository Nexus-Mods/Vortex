import { showDialog } from '../../actions/notifications';
import { setDialogVisible } from '../../actions/session';
import OptionsFilter, { ISelectOption } from '../../controls/table/OptionsFilter';
import {
  GameInfoQuery,
  IExtensionApi,
  IExtensionContext,
} from '../../types/IExtensionContext';
import { IGame } from '../../types/IGame';
import isIGame from '../../types/IGame.validator';
import { IGameStore } from '../../types/IGameStore';
import { IProfile, IRunningTool, IState } from '../../types/IState';
import { IEditChoice, ITableAttribute } from '../../types/ITableAttribute';
import { COMPANY_ID } from '../../util/constants';
import {DataInvalid, ProcessCanceled, SetupError, UserCanceled} from '../../util/CustomErrors';
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

import { IExtensionDownloadInfo } from '../extension_manager/types';
import { setModType } from '../mod_management/actions/mods';
import { IModWithState } from '../mod_management/views/CheckModVersionsButton';
import { setNextProfile } from '../profile_management/actions/settings';

import { setGameInfo } from './actions/persistent';
import { addDiscoveredGame, setGamePath, setGameSearchPaths } from './actions/settings';
import { discoveryReducer } from './reducers/discovery';
import { persistentReducer } from './reducers/persistent';
import { sessionReducer } from './reducers/session';
import { settingsReducer } from './reducers/settings';
import { IDiscoveryResult } from './types/IDiscoveryResult';
import { IGameStored } from './types/IGameStored';
import { IModType } from './types/IModType';
import getDriveList from './util/getDriveList';
import { getGame } from './util/getGame';
import { getModTypeExtensions, registerModType } from './util/modTypeExtensions';
import ProcessMonitor from './util/ProcessMonitor';
import queryGameInfo from './util/queryGameInfo';
import {} from './views/GamePicker';
import HideGameIcon from './views/HideGameIcon';
import PathSelectionDialog from './views/PathSelection';
import ProgressFooter from './views/ProgressFooter';
import RecentlyManagedDashlet from './views/RecentlyManagedDashlet';

import GameModeManager, { IGameStub } from './GameModeManager';
import { currentGame, currentGameDiscovery, discoveryByGame } from './selectors';

import Promise from 'bluebird';
import { remote } from 'electron';
import * as fsExtra from 'fs-extra';
import * as path from 'path';
import * as Redux from 'redux';
import * as semver from 'semver';

const gameStoreLaunchers: IGameStore[] = [];
const extensionGames: IGame[] = [];
const extensionStubs: IGameStub[] = [];

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

  const gameInfo = store.getState().persistent.gameMode.gameInfo?.[gameId] || {};

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
    Promise.resolve(fsExtra.stat(path.join(gamePath, file))))
    .then(() => undefined)
    .catch(err => {
      // if the error is anything other than "the file doesn't exist" we assume
      // the file is there and can't be accessed because of permissions or something.
      // If the game gets started through the launcher, that may be completely valid
      // so this isn't the place to report an error.
      if (err.code !== 'ENOENT') {
        return undefined;
      }
      return Promise.reject(err);
    });
}

function searchDepth(files: string[]): number {
  return files.reduce((prev, filePath) => {
    const len = process.platform === 'win32'
      ? filePath.split(/[/\\]/).length
      : filePath.split(path.sep).length;
    return Math.max(prev, len);
  }, 0);
}

// based on a path the user selected, traverse the directory tree upwards because
// if the game contains a directory hierarchy like Game/Binaries/Win64/foobar.exe, the user
// may have selected the "Win64" directory instead of "Game"
function findGamePath(game: IGame, selectedPath: string,
                      depth: number, maxDepth: number): Promise<string> {
  if (depth > maxDepth) {
    return Promise.reject(new ProcessCanceled('not found'));
  }

  return verifyGamePath(game, selectedPath)
    .then(() => selectedPath)
    .catch({ code: 'ENOENT' }, () =>
      findGamePath(game, path.dirname(selectedPath), depth + 1, maxDepth));
}

function browseGameLocation(api: IExtensionApi, gameId: string): Promise<void> {
  const state: IState = api.store.getState();
  const game = getGame(gameId);

  if (game === undefined) {
    return Promise.resolve();
  }

  const discovery = state.settings.gameMode.discovered[gameId];

  return new Promise<void>((resolve, reject) => {
    if ((discovery !== undefined) && (discovery.path !== undefined)) {
      remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
        properties: ['openDirectory'],
        defaultPath: discovery.path,
      })
      .then(result => {
        const { filePaths } = result;
        if ((filePaths !== undefined) && truthy(filePaths[0])) {
          findGamePath(game, filePaths[0], 0, searchDepth(game.requiredFiles))
            .then((corrected: string) => {
              api.store.dispatch(setGamePath(game.id, corrected));
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
      })
      .then(result => {
        const { filePaths } = result;
        if ((filePaths !== undefined) && (filePaths.length > 0)) {
          findGamePath(game, filePaths[0], 0, searchDepth(game.requiredFiles || []))
            .then((corrected: string) => {
              const exe = game.executable(corrected);
              api.store.dispatch(addDiscoveredGame(game.id, {
                path: corrected,
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

function installGameExtenstion(api: IExtensionApi,
                               gameId: string,
                               dlInfo: IExtensionDownloadInfo)
                               : Promise<void> {
  if (dlInfo !== undefined) {
    log('info', 'installing missing game extension', { gameId });
    const name = dlInfo.name.replace(/^Game: /, '');
    return api.showDialog('info', dlInfo.name, {
      text: 'In an older version of Vortex you were managing "{{name}}", however, '
          + 'the extension for this game is no longer included in the main Vortex release. '
          + 'A new version of this extension is available from a community developer.\n\n'
          + 'If you wish to continue to manage "{{name}}" you will need to install the latest '
          + 'community release of the extension. '
          + 'Alternatively, you can unmanage this game which will remove it from Vortex and '
          + 'delete all installed mods.',
      parameters: {
        name,
      },
    }, [
      { label: 'Ask later' },
      { label: 'Stop managing' },
      { label: 'Install' },
    ])
      .then(result => {
        if (result.action === 'Install') {
          return api.emitAndAwait('install-extension', dlInfo);
        } else if (result.action === 'Stop managing') {
          return api.ext.unmanageGame?.(gameId, dlInfo.name);
        } else {
          return Promise.resolve(false);
        }
      })
      .catch(err => {
        if ((err instanceof UserCanceled)
          || (err instanceof ProcessCanceled)) {
          return Promise.resolve();
        }
        api.showErrorNotification('Failed to install game extension', err);
      });
  } else {
    return Promise.resolve();
  }
}

function awaitProfileSwitch(api: IExtensionApi): Promise<string> {
  const { activeProfileId, nextProfileId } = api.getState().settings.profiles;
  if (activeProfileId !== nextProfileId) {
    return new Promise(resolve => api.events.once('profile-did-change', resolve));
  } else {
    return Promise.resolve(activeProfileId);
  }
}

function removeDisappearedGames(api: IExtensionApi,
                                gameStubs?: { [gameId: string]: IExtensionDownloadInfo })
                                : Promise<void> {
  log('info', 'remove disappeared games');
  let state: IState = api.getState();
  const discovered = state.settings.gameMode.discovered;
  const known = state.session.gameMode.known;
  let gameMode = activeGameId(state);
  const managedGames = new Set(Object.values(state.persistent.profiles).map(prof => prof.gameId));

  return Promise.map(
    Object.keys(discovered).filter(gameId => discovered[gameId].path !== undefined),
    gameId => {
      const stored = known.find(iter => iter.id === gameId);
      return stored === undefined
        ? Promise.resolve()
        : Promise.map(stored.requiredFiles,
          file => fsExtra.stat(path.join(discovered[gameId].path, file)))
          .then(() => undefined)
          .catch(err => {
            if (err.code === 'EPERM') {
              // ignore permission errors because this is "normal" for games installed
              // through the microsoft store.
              return;
            }
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
    })
    .then(() => awaitProfileSwitch(api))
    .then(() => {
      state = api.getState();
      gameMode = activeGameId(state);
      if (known.find(game => game.id === gameMode) === undefined) {
        log('info', 'the active game is no longer known, resetting', { activeGame: gameMode ?? 'none', known });
        api.store.dispatch(setNextProfile(undefined));
      }

      if (gameStubs !== undefined) {
        const knownGameIds = new Set(known.map(game => game.id));
        return Promise.all(Array.from(managedGames).map(gameId => {
          if (knownGameIds.has(gameId)) {
            return Promise.resolve();
          }
          return installGameExtenstion(api, gameId, gameStubs[gameId]);
        }))
          .then(() => Promise.resolve());
      } else {
        return Promise.resolve();
      }
    });
}

function genModTypeAttribute(api: IExtensionApi): ITableAttribute<IModWithState> {
  const modTypes = (): ISelectOption[] => {
    const gameMode = activeGameId(api.store.getState());
    return getModTypeExtensions()
      .filter((type: IModType) => type.isSupported(gameMode))
      .map(ext => {
        const value = ext.options?.name ?? ext.typeId;
        return {
          value,
          label: value,
        };
      });
  };

  return {
    id: 'modType',
    name: 'Mod Type',
    description: 'Type of the mod (decides where it gets deployed to)',
    placement: 'both',
    calc: mod => {
      const modType = getModTypeExtensions().find(iter => iter.typeId === mod.type);
      if (modType === undefined) {
        return mod.type;
      }
      return modType.options.name || mod.type;
    },
    help: 'The mod type controls where (and maybe even how) a mod gets deployed. '
      + 'Leave empty (default) unless you know what you\'re doing.',
    supportsMultiple: true,
    isSortable: true,
    isDefaultVisible: false,
    isToggleable: true,
    isGroupable: true,
    filter: new OptionsFilter(modTypes, true, false),
    edit: {
      placeholder: () => api.translate('Default'),
      choices: () => {
        const gameMode = activeGameId(api.store.getState());
        return getModTypeExtensions()
          .filter((type: IModType) => type.isSupported(gameMode))
          .map((type: IModType): IEditChoice =>
            ({ key: type.typeId, text: (type.options.name || type.typeId || 'Default') }));
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

  const onRefreshGameInfo = (gameId: string) => refreshGameInfo(context.api.store, gameId);
  const onBrowseGameLocation = (gameId: string) => browseGameLocation(context.api, gameId);

  context.registerMainPage('game', 'Games', LazyComponent(() => require('./views/GamePicker')), {
    hotkey: 'G',
    group: 'global',
    props: () => ({
      onRefreshGameInfo,
      onBrowseGameLocation,
    }),
    activity,
  });
  context.registerReducer(['session', 'discovery'], discoveryReducer);
  context.registerReducer(['session', 'gameMode'], sessionReducer);
  context.registerReducer(['settings', 'gameMode'], settingsReducer);
  context.registerReducer(['persistent', 'gameMode'], persistentReducer);
  context.registerFooter('discovery-progress', ProgressFooter);

  context.registerTableAttribute('mods', genModTypeAttribute(context.api));

  context.registerGameStore = ((gameStore: IGameStore) => {
    if (gameStore === undefined) {
      context.api.showErrorNotification('Invalid game store extension not loaded', undefined, {
        allowReport: false,
        message: 'A game store extension failed to initialize',
      });
      return;
    }

    try {
      gameStoreLaunchers.push(gameStore);
    } catch (err) {
      context.api.showErrorNotification('Game store launcher extension not loaded', err, {
        allowReport: false,
        message: gameStore.id,
      });
    }
  }) as any;

  // TODO: hack, we need the extension path to get at the assets but this parameter
  //   is only added internally and not part of the public api
  context.registerGame = ((game: IGame, extensionPath: string) => {
    try {
      if (!isIGame(game)) {
        log('warn', 'invalid game extension', { errors: isIGame.errors });
        throw new Error('Invalid game extension: ' + isIGame.errors.map(err => err.message).join(', '));
      }
      game.extensionPath = extensionPath;
      const gameExtInfo = JSON.parse(
        fs.readFileSync(path.join(extensionPath, 'info.json'), { encoding: 'utf8' }));
      game.contributed = (gameExtInfo.author === COMPANY_ID)
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

  context.registerGameStub = (game: IGame, ext: IExtensionDownloadInfo) => {
    extensionStubs.push({ ext, game });
  };

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
    let gamePath = getSafe(discoveredGames, [instanceIds[0], 'path'], undefined);

    if (gamePath !== undefined) {
      if (!gamePath.endsWith(path.sep)) {
        gamePath += path.sep;
      }
      opn(gamePath).catch(() => undefined);
    }
  };

  const openModFolder = (instanceIds: string[]) => {
    const discoveredGames = context.api.store.getState().settings.gameMode.discovered;
    const discovered = getSafe(discoveredGames, [instanceIds[0]], undefined);
    if (discovered !== undefined) {
      try {
        let targetPath = getGame(instanceIds[0]).getModPaths(discovered.path)[''];
        if (!targetPath.endsWith(path.sep)) {
          targetPath += path.sep;
        }
        opn(targetPath).catch(() => undefined);
      } catch (err) {
        log('warn', 'failed to open mod directory', err.message);
      }
    }
  };

  context.registerAction('game-icons', 100, 'refresh', {}, 'Scan: Quick', () => {
    if ($.gameModeManager !== undefined) {
      // we need the state from before the discovery so can determine which games were discovered
      const oldState: IState = context.api.getState();
      $.gameModeManager.startQuickDiscovery()
        .then((gameIds: string[]) => {
          const discoveredGames = oldState.settings.gameMode.discovered;
          const knownGames = oldState.session.gameMode.known;
          const newGames = gameIds.filter(id =>
            (discoveredGames[id] === undefined) || (discoveredGames[id].path === undefined));

          const newState = context.api.getState();
          const numDiscovered =
            Object.values(newState.settings.gameMode.discovered)
              .filter(iter => iter.path !== undefined).length;

          let message =
            context.api.translate('{{numTotal}} games discovered ({{numNew}} new)', {
            replace: {
              numNew: newGames.length,
              numTotal: numDiscovered,
            },
          });

          if (newGames.length > 0) {
            message += '\n' + newGames
              .map(id => '- ' + knownGames.find(iter => iter.id === id).name)
              .join('\n');
          }

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
        context.api.events.emit('start-discovery');
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

  context.registerAction('game-undiscovered-buttons', 120, 'browse', {},
    context.api.translate('Manually Set Location'),
    (instanceIds: string[]) => { browseGameLocation(context.api, instanceIds[0]); });

  context.registerDashlet('Recently Managed', 2, 2, 175, RecentlyManagedDashlet,
                          undefined, undefined, undefined);

  context.registerDialog('game-search-paths', PathSelectionDialog, () => ({
    onScan: (paths: string[]) => {
      $.gameModeManager.startSearchDiscovery(paths);
    },
    onSelectPath: (basePath: string): Promise<string> => {
      return Promise.resolve(remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
        properties: ['openDirectory'],
        defaultPath: basePath,
      })
      .then(result => result.filePaths[0]));
    },
  }));

  context.once(() => {
    const store: Redux.Store<IState> = context.api.store;
    const events = context.api.events;

    const GameModeManagerImpl: typeof GameModeManager = require('./GameModeManager').default;

    $.gameModeManager = new GameModeManagerImpl(
      extensionGames,
      extensionStubs,
      gameStoreLaunchers,
      (gameMode: string) => {
        log('debug', 'gamemode activated', gameMode);
        events.emit('gamemode-activated', gameMode);
      });
    $.gameModeManager.attachToStore(store);
    $.gameModeManager.startQuickDiscovery()
      .then(() => removeDisappearedGames(context.api, extensionStubs.reduce((prev, stub) => {
        prev[stub.game.id] = stub.ext;
        return prev;
      }, {})));

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
        const state = context.api.getState();
        const initPromise: Promise<void> = state.settings.gameMode.searchPaths.length > 0
          ? Promise.resolve()
          : Promise.resolve(getDriveList(context.api))
              .catch(() => ([]))
              .then(drives => { context.api.store.dispatch(setGameSearchPaths(drives)); });

        initPromise
          .then(() => {
            context.api.store.dispatch(setDialogVisible('game-search-paths'));
          });
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

    events.on('manually-set-game-location', (gameId: string, callback: (err: Error) => void) => {
      browseGameLocation(context.api, gameId)
        .then(() => callback(null))
        .catch(err => callback(err));
    });

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
      });

      // Important: This happens after the profile has already been activated
      //   and while the ui is usable again so at this point the user can already
      //   switch the game/profile again. The code below has to be able to deal with that
      return $.gameModeManager.setupGameMode(newGameId)
        .then(() => {
          // only calling to check if it works, some game extensions might discover
          // a setup-error when trying to resolve the mod path
          const discovery = discoveryByGame(store.getState(), newGameId);
          if ((discovery === undefined) || (discovery.path === undefined)) {
            return Promise.reject(new ProcessCanceled('The game is no longer discovered'));
          }
          getGame(newGameId).getModPaths(discovery.path);
        })
        .then(() => $.gameModeManager.setGameMode(oldGameId, newGameId, currentProfileId))
        .catch((err) => {
          if ((err instanceof UserCanceled) || (err instanceof ProcessCanceled)) {
            // nop
          } else if ((err instanceof SetupError)
                    || (err instanceof DataInvalid)) {
            showError(store.dispatch, 'Failed to set game mode', err, {
              allowReport: false, message: newGameId, id: 'failed-to-set-gamemode' });
          } else {
            showError(store.dispatch, 'Failed to set game mode', err, {
              message: newGameId, id: 'failed-to-set-gamemode',
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
              title: 'Switched game mode',
              message: game.name,
              displayMS: 4000,
            });
          }
          return null;
        });
      });

    const processMonitor = new ProcessMonitor(context.api);
    interface IRunningMap { [exePath: string]: IRunningTool; }
    context.api.onStateChange(['session', 'base', 'toolsRunning'],
      (prev: IRunningMap, current: IRunningMap) => {
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
