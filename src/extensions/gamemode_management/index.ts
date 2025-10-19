/* eslint-disable */
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
import { COMPANY_ID, NEXUSMODS_EXT_ID } from '../../util/constants';
import {DataInvalid, ProcessCanceled, SetupError, UserCanceled} from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import { validateRequiredFilesWithMacOSCompat, MACOS_GAME_FIXES } from '../../util/macOSGameCompatibility';
import GameStoreHelper from '../../util/GameStoreHelper';
import LazyComponent from '../../util/LazyComponent';
import local from '../../util/local';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import opn from '../../util/opn';
import ReduxProp from '../../util/ReduxProp';
import { activeProfile } from '../profile_management/activeGameId';
import { activeGameId } from '../profile_management/activeGameId';
import { getSafe } from '../../util/storeHelper';
import { isWindows } from '../../util/platform';

import { batchDispatch } from '../../util/util';

import { IExtensionDownloadInfo, ExtensionType } from '../extension_manager/types';
import { setInstalledExtensions } from '../extension_manager/actions';
import { readExtensionsSync } from '../extension_manager/util';
import { setModType } from '../mod_management/actions/mods';
import { IModWithState } from '../mod_management/views/CheckModVersionsButton';
import { nexusGames } from '../nexus_integration/util';
import { setNextProfile } from '../profile_management/actions/settings';

import { setGameInfo } from './actions/persistent';
import { addDiscoveredGame, clearDiscoveredGame, setGamePath, setGameSearchPaths } from './actions/settings';
import { setKnownGames } from './actions/session';
import { discoveryReducer } from './reducers/discovery';
import { persistentReducer } from './reducers/persistent';
import { sessionReducer } from './reducers/session';
import { settingsReducer } from './reducers/settings';
import { discoveryProgressReducer } from './reducers/discoveryProgress';
import { IDiscoveryResult } from './types/IDiscoveryResult';
import { IGameStored } from './types/IGameStored';
import { IModType } from './types/IModType';
import getDriveList from './util/getDriveList';
import { getGame, getGameStore, getGameStores } from './util/getGame';
import { getModType, getModTypeExtensions, registerModType } from './util/modTypeExtensions';
import ProcessMonitor from './util/ProcessMonitor';
import queryGameInfo from './util/queryGameInfo';
import {} from './views/GamePicker';
import HideGameIcon from './views/HideGameIcon';
import ModTypeWidget from './views/ModTypeWidget';
import PathSelectionDialog from './views/PathSelection';
import ProgressFooter from './views/ProgressFooter';
import RecentlyManagedDashlet from './views/RecentlyManagedDashlet';

import GameModeManager, { IGameStub } from './GameModeManager';
import GameDiscoveryService from '../../services/GameDiscoveryService';
import { currentGame, currentGameDiscovery, discoveryByGame, gameById } from './selectors';

// TODO: Remove Bluebird import - using native Promise;
import { promiseMap } from '../../util/bluebird-migration-helpers.local';
import * as fsExtra from 'fs-extra';
import * as path from 'path';
import * as Redux from 'redux';
import * as semver from 'semver';
import React from 'react';

import { clipboard } from 'electron';

const gameStoreLaunchers: IGameStore[] = [];

const $ = local<{
  gameModeManager: GameModeManager,
  extensionGames: IGame[],
  extensionStubs: IGameStub[],
}>('gamemode-management', {
  gameModeManager: undefined,
  extensionGames: [],
  extensionStubs: [],
});

// File to store discovered games persistently
const DISCOVERED_GAMES_FILE = 'discovered_games.json';

// Function to save discovered games to a persistent file
async function saveDiscoveredGames(api: IExtensionApi) {
  try {
    const state = api.getState();
    const discoveredGames = state.settings.gameMode.discovered;
    
    // Filter out games without paths (not actually discovered)
    const validDiscoveredGames = {};
    Object.keys(discoveredGames).forEach(gameId => {
      if (discoveredGames[gameId].path !== undefined) {
        validDiscoveredGames[gameId] = discoveredGames[gameId];
      }
    });
    
    // Save to a file in the user data directory
    const userDataPath = api.store.getState().app.paths.userData;
    const filePath = path.join(userDataPath, DISCOVERED_GAMES_FILE);
    
    await fs.writeFileAsync(filePath, JSON.stringify(validDiscoveredGames, null, 2));
  } catch (err) {
    // Don't fail if we can't save, just log it
    log('warn', 'Failed to save discovered games', { error: err.message });
  }
}

// Function to load discovered games from the persistent file
async function loadDiscoveredGames(api: IExtensionApi) {
  try {
    const userDataPath = api.store.getState().app.paths.userData;
    const filePath = path.join(userDataPath, DISCOVERED_GAMES_FILE);
    
    // Check if file exists
    try {
      await fs.statAsync(filePath);
    } catch (err) {
      // File doesn't exist, that's fine
      return;
    }
    
    // Read and parse the file
    const data = await fs.readFileAsync(filePath, { encoding: 'utf8' });
    const discoveredGames = JSON.parse(data);
    
    // Dispatch actions to restore discovered games
    Object.keys(discoveredGames).forEach(gameId => {
      api.store.dispatch(addDiscoveredGame(gameId, discoveredGames[gameId]));
    });
    
    log('info', 'Restored discovered games from persistent storage', { count: Object.keys(discoveredGames).length });
  } catch (err) {
    // Don't fail if we can't load, just log it
    log('warn', 'Failed to load discovered games', { error: err.message });
  }
}

interface IProvider {
  id: string;
  priority: number;
  expireMS: number;
  keys: string[];
  query: GameInfoQuery;
}

const gameInfoProviders: IProvider[] = [];

// Add this at the top of the file with the other module-level variables
let isRefreshingGameList = false;

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

  return promiseMap(providersToQuery, prov => {
    const expires = now + prov.expireMS;
    return prov.query({ ...game, ...gameDiscovery })
      .then(details => {
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
          store.dispatch(setGameInfo(gameId, prov.id, prov.priority, expires, values));
        }
      })
      .catch(err => { 
        log('error', 'failed to retrieve game info', { provider: prov.id, error: err.message });
      });
  })
    .then(() => undefined);
}

function verifyGamePath(game: IGame, gamePath: string): Promise<void> {
  return Promise.resolve(validateRequiredFilesWithMacOSCompat(gamePath, game.requiredFiles || [], game.id))
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
    const len = isWindows()
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
    .catch(err => { if (err.code === 'ENOENT') {
      findGamePath(game, path.dirname(selectedPath), depth + 1, maxDepth));
}

function manualGameStoreSelection(api: IExtensionApi, correctedGamePath: string): Promise<{ store: string, corrected: string }> {
  const gameStores = getGameStores();
  return GameStoreHelper.identifyStore(correctedGamePath)
    .then((storeId) => {
      const detectedStore = gameStores.find(store => store.id === storeId);
      return api.showDialog('question', 'Choose a Game Store', {
      bbcode: api.translate('The currently identified game store for your selected game directory is: "{{gameStore}}".[br][/br][br][/br]'
        + 'If this is not the correct game store, please choose below. (Games can have game store specific folder structures)[br][/br][br][/br]',
          { replace: { gameStore: detectedStore?.name || 'Unknown' } }),
      choices: gameStores.map((store) => ({ id: store.id, text: store.name, value: store.id === storeId }))
                         .concat({ id: 'other', text: 'Other', value: storeId === undefined }),
    }, [
      { label: 'Select' },
    ])
    .then((res) => {
      const selected = Object.keys(res.input).find(iter => res.input[iter]);
      if (selected === undefined) {
        return Promise.reject(new UserCanceled());
      }
      if (selected === 'other') {
        return { store: storeId, corrected: correctedGamePath };
      } else {
        return { store: selected, corrected: correctedGamePath };
      }
    });
  })
}

function browseGameLocation(api: IExtensionApi, gameId: string): Promise<void> {
  const state: IState = api.store.getState();

  if (gameById(state, gameId) === undefined) {
    // Proactively refresh installed extensions to avoid stale state
    try {
      const extensions = readExtensionsSync(true);
      api.store.dispatch(setInstalledExtensions(extensions));
      log('info', 'Synchronized installed extensions before showing missing support dialog', {
        extensionCount: Object.keys(extensions).length,
      });
    } catch (err) {
      log('warn', 'Failed to synchronize installed extensions', { error: err.message });
    }
    // Find the extension to get the game name
    const extension = state.session.extensions?.available?.find(ext =>
      (ext?.gameId === gameId) || (ext.name === gameId));
    
    // Get the game name for better user messaging
    const gameName = extension?.gameName || extension?.name?.replace(/^Game: /, '') || 'this game';
    
    return api.showDialog('question', 'Game Support Not Installed', {
      text: 'Support for {{gameName}} is provided through a community extension that is not included with the main Vortex application. '
          + 'To manage mods for {{gameName}}, you need to download and install this extension.',
      parameters: {
        gameName
      }
    }, [
      { label: 'Close' },
    ])
      .then(() => null);
  }

  const game = getGame(gameId);

  if (game === undefined) {
    return Promise.resolve();
  }

  const discovery = state.settings.gameMode.discovered[gameId];

  return new Promise<void>((resolve) => {
    const defaultPath = discovery?.path;

    api.selectDir(defaultPath !== undefined ? { defaultPath } : {})
      .then(result => {
        if (result !== undefined) {
          findGamePath(game, result, 0, searchDepth(game.requiredFiles || []))
            .then((corrected: string) => manualGameStoreSelection(api, corrected))
            .then(({ corrected, store }) => {
              let executable = game.executable(corrected);
              if (executable === game.executable()) {
                executable = undefined;
              }
              // different paths depending on whether the game was previously detected
              // or not so that we don't overwrite user settings
              if (defaultPath !== undefined) {
                api.store.dispatch(setGamePath(game.id, corrected, store, executable));
              } else {
                api.store.dispatch(addDiscoveredGame(game.id, {
                  path: corrected,
                  tools: {},
                  hidden: false,
                  environment: game.environment,
                  executable,
                  pathSetManually: true,
                  store,
                }));
              }
              resolve();
            })
            .catch(() => {
              api.store.dispatch(showDialog('error', 'Game not found', {
                text: api.translate(
                  'This directory doesn\'t appear to contain the game.\n'
                  + 'Usually you need to select the top-level game directory, '
                  + 'containing the following files:\n{{ files }}',
                  { replace: { files: game.requiredFiles.join('\n') } }),
              }, [
                { label: 'Cancel', action: () => resolve() },
                {
                  label: 'Try Again',
                  action: () => browseGameLocation(api, gameId).then(() => resolve())
                },
              ]));
            });
        } else {
          resolve();
        }
      });
  });
}

function installGameExtension(api: IExtensionApi,
                              gameId: string,
                              dlInfo: IExtensionDownloadInfo)
                              : Promise<void> {
  // prevent re-entry: avoid showing the install dialog repeatedly while an install is ongoing
  const installingGameExtensions = (installGameExtension as any).mInstallingGameExtensions
    || ((installGameExtension as any).mInstallingGameExtensions = new Set<string>());

  if (dlInfo !== undefined) {
    if (installingGameExtensions.has(gameId)) {
      log('info', 'skipping duplicate install prompt for game extension', { gameId });
      return Promise.resolve();
    }
    installingGameExtensions.add(gameId);
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
          return api.emitAndAwait('install-extension', dlInfo)
            .finally(() => installingGameExtensions.delete(gameId));
        } else if (result.action === 'Stop managing') {
          api.events.emit(
            'analytics-track-click-event', 'Games', 'Stop managing game',
          );
          return Promise.resolve(api.ext.unmanageGame?.(gameId, dlInfo.name))
            .finally(() => installingGameExtensions.delete(gameId));
        } else {
          installingGameExtensions.delete(gameId);
          return Promise.resolve(false);
        }
      })
      .catch(err => {
        if ((err instanceof UserCanceled)
          || (err instanceof ProcessCanceled)) {
          installingGameExtensions.delete(gameId);
          return Promise.resolve();
        }
        installingGameExtensions.delete(gameId);
        api.showErrorNotification('Failed to install game extension', err);
      });
  } else {
    return Promise.resolve();
  }
}

function awaitProfileSwitch(api: IExtensionApi): Promise<string> {
  const { activeProfileId, nextProfileId } = api.getState().settings.profiles;
  log('info', 'wait for profile switch to complete', { nextProfileId, activeProfileId });
  if (activeProfileId !== nextProfileId) {
    return new Promise(resolve => api.events.once('profile-did-change', resolve));
  } else {
    return Promise.resolve(activeProfileId);
  }
}

function removeDisappearedGames(api: IExtensionApi,
                                discoveredGames: Set<string>,
                                gameStubs?: { [gameId: string]: IExtensionDownloadInfo })
                                : Promise<void> {
  let state: IState = api.getState();
  const discovered = state.settings.gameMode.discovered;
  const known = state.session.gameMode.known;
  let gameMode = activeGameId(state);
  const managedGames = new Set(Object.values(state.persistent.profiles).map(prof => prof.gameId));

  log('info', 'remove disappeared games');

  const assertRequiredFiles = (requiredFiles: string[], gameId: string): Promise<void> => {
    if (requiredFiles === undefined) {
      return Promise.resolve();
    }
    return Promise.resolve(validateRequiredFilesWithMacOSCompat(discovered[gameId].path, requiredFiles, gameId))
          .catch(err => {
            if (err.code === 'ENOENT') {
              return Promise.reject(err);
            } else {
              return Promise.resolve();
            }
          });
  };

  return promiseMap(
    Object.keys(discovered).filter(gameId => discovered[gameId].path !== undefined), gameId => {
      const stored = known.find(iter => iter.id === gameId);
      return fsExtra.stat(discovered[gameId].path)
        .then(() => assertRequiredFiles(stored?.requiredFiles, gameId))
        .catch(err => {
          if (err.code === 'ENOENT') {
            return Promise.reject(err);
          }
          // if we can't stat the game directory for any other reason than it being missing
          // (almost certainly permission error) we just assume the game is installed and
          // can be launched through the store because that's how it works with the xbox store
          // and we have to support that.
          return Promise.resolve();
        })
        .catch(err => {
          const gameName = stored?.name ?? discovered[gameId].name;
          if (discoveredGames.has(gameId)) {
            log('info', 'game no longer found',
              { gameName: gameName ?? 'Unknown', reason: err.message });
            if (gameName !== undefined) {
              api.sendNotification({
                type: 'info',
                message: api.translate('{{gameName}} no longer found',
                  { replace: { gameName } }),
              });
            }
          } else {
            log('debug', 'game discovery found invalid game path', {
              gameName,
              path: discovered[gameId].path,
            });
          }

          const batchedActions = [];
          if (gameId === gameMode) {
            // Show a notification to the user about the automatic profile switch
            api.sendNotification({
              type: 'warning',
              message: api.translate('Game {{gameName}} is no longer available. Switching to no active profile.', 
                { replace: { gameName: gameName || gameId } }),
              displayMS: 5000,
            });
            batchedActions.push(setNextProfile(undefined));
          }

          batchedActions.push(clearDiscoveredGame(gameId));
          batchDispatch(api.store, batchedActions);
        });
    })
    .then(() => awaitProfileSwitch(api))
    .then(() => {
      state = api.getState();
      gameMode = activeGameId(state);
      if (known.find(game => game.id === gameMode) === undefined) {
        log('info', 'the active game is no longer known, resetting', { activeGame: gameMode ?? 'none', known });
        // Notify user about automatic profile reset
        api.sendNotification({
          type: 'warning',
          message: api.translate('Active game is no longer supported. Switching to no active profile.'),
          displayMS: 5000,
        });
        api.store.dispatch(setNextProfile(undefined));
      }

      if (gameStubs !== undefined) {
        const knownGameIds = new Set(known.map(game => game.id));
        return Promise.all(Array.from(managedGames).map(gameId => {
          if (knownGameIds.has(gameId)) {
            return Promise.resolve();
          }
          return installGameExtension(api, gameId, gameStubs[gameId]);
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

  const copyToClipboard = (value: string) => {
    if (value) {
      clipboard.writeText(value);
      api.sendNotification({
        type: 'success',
        message: api.translate('Copied mod type id to clipboard'),
        displayMS: 2000,
      });
    }
  };
  
  const modTypeCalc = (mods: IModWithState | IModWithState[]) => {
    const mod: IModWithState = Array.isArray(mods) ? mods[0] : mods;

    const modType = getModType(mod.type);
    if (modType === undefined) {
      return mod.type;
    }
    return modType.options.name || mod.type;
  };

  return {
    id: 'modType',
    name: 'Mod Type',
    description: 'Type of the mod (decides where it gets deployed to)',
    placement: 'both',
    calc: modTypeCalc,
    customRenderer: (mods, detailCell) =>
        detailCell
          ? React.createElement(ModTypeWidget, { mods, copyToClipboard })
          : React.createElement('span', {}, [modTypeCalc(mods)]),
    cssClass: mod => (mod.type !== '')
        ? `mod-modtype-${mod.type}`
        : undefined,
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
          api.events.emit('recalculate-modtype-conflicts', mods.map(mod => mod.id));
        } else {
          setModId(mods);
          api.events.emit('recalculate-modtype-conflicts', [mods.id]);
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

  context.registerReducer(['session', 'discovery'], discoveryReducer);
  context.registerReducer(['session', 'gameMode'], sessionReducer);
  context.registerReducer(['session', 'discoveryProgress'], discoveryProgressReducer);
  context.registerReducer(['settings', 'gameMode'], settingsReducer);
  context.registerReducer(['persistent', 'gameMode'], persistentReducer);

  context.registerMainPage('game', 'Games', LazyComponent(() => require('./views/GamePicker')), {
    hotkey: 'G',
    group: 'global',
    props: () => ({
      onRefreshGameInfo,
      onBrowseGameLocation,
      nexusGames: nexusGames(),
    }),
    activity,
  });
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
      if (gameStore.name === undefined) {
        gameStore.name = gameStore.id;
      }
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
      const infoPath = path.join(extensionPath, 'info.json');
      const gameExtInfo = JSON.parse(
        fs.readFileSync(infoPath, { encoding: 'utf8' }));
      
      // Automatically set extension type to 'game' if not already set
      if (gameExtInfo.type !== 'game') {
        gameExtInfo.type = 'game';
        try {
          fs.writeFileSync(infoPath, JSON.stringify(gameExtInfo, null, 2), { encoding: 'utf8' });
          log('info', 'automatically updated extension type to game', { 
            extensionPath, 
            gameName: game.name 
          });
          
          // Update the in-memory extension state to reflect the type change
          const state = context.api.getState();
          const installedExtensions = state.session.extensions?.installed || {};
          const extensionId = path.basename(extensionPath);
          
          if (installedExtensions[extensionId]) {
            const updatedExtensions = {
               ...installedExtensions,
               [extensionId]: {
                 ...installedExtensions[extensionId],
                 type: 'game' as ExtensionType
               }
             };
            context.api.store.dispatch(setInstalledExtensions(updatedExtensions));
            log('info', 'updated extension type in memory', { extensionId, gameName: game.name });
          }
        } catch (writeErr) {
          log('warn', 'failed to update extension type to game', { 
            extensionPath, 
            error: writeErr.message 
          });
        }
      }
      
      game.contributed = (gameExtInfo.author === COMPANY_ID || gameExtInfo.author === NEXUSMODS_EXT_ID)
        ? undefined
        : gameExtInfo.author;
      game.final = semver.gte(gameExtInfo.version, '1.0.0');
      game.version = gameExtInfo.version;
      $.extensionGames.push(game);
    } catch (err) {
      context.api.showErrorNotification('Game Extension not loaded', err, {
        allowReport: false,
        message: game.name,
      });
    }
  }) as any;

  context.registerGameStub = (game: IGame, ext: IExtensionDownloadInfo) => {
    $.extensionStubs.push({ ext, game });
  };

  context.registerGameInfoProvider =
    (id: string, priority: number, expireMS: number, keys: string[], query: GameInfoQuery) => {
      gameInfoProviders.push({ id, priority, expireMS, keys, query });
  };

  context.registerModType = registerModType;

  context.registerGameInfoProvider('game-path', 0, 1000,
    ['path'], (game: IGame & IDiscoveryResult) => (game.path == null || typeof game.path !== 'string')
      ? Promise.resolve({})
      : Promise.resolve({
        path: { title: 'Path', value: path.normalize(game.path), type: 'url' },
      }));

  context.registerGameInfoProvider('game-store', 15, 60 * 1000,
    ['store'], (game: IGame & IDiscoveryResult) => Promise.resolve({ store: {
      title: 'Game Store',
      value: getGameStore(game.store)?.name ?? context.api.translate('Unknown'),
      type: 'string' } }));

  context.registerGameInfoProvider('main', 30, 86400000,
    ['size', 'size_nolinks'], queryGameInfo);

  const openGameFolder = (instanceIds: string[]) => {
    const discoveredGames = context.api.store.getState().settings.gameMode.discovered;
    let gamePath = getSafe(discoveredGames, [instanceIds[0], 'path'], undefined);

    if (gamePath != null) {
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

  const gameIsDiscovered = (gameIds: string[]) =>
    context.api.getState().settings.gameMode.discovered[gameIds[0]]?.path !== undefined;

  context.registerAction('game-managed-buttons', 100, HideGameIcon, {});
  context.registerAction('game-unmanaged-buttons', 100, HideGameIcon, {});
  context.registerAction('game-managed-buttons', 105, 'open-ext', {},
                         context.api.translate('Open Game Folder'),
                         openGameFolder);
  context.registerAction('game-unmanaged-buttons', 105, 'open-ext', {},
                         context.api.translate('Open Game Folder'),
                         openGameFolder,
                         gameIsDiscovered);
  context.registerAction('game-managed-buttons', 110, 'open-ext', {},
                         context.api.translate('Open Mod Folder'),
                         openModFolder);
  context.registerAction('game-unmanaged-buttons', 110, 'open-ext', {},
                         context.api.translate('Open Mod Folder'),
                         openModFolder,
                         gameIsDiscovered);
  context.registerAction('game-managed-buttons', 120, 'browse', {},
    context.api.translate('Manually Set Location'),
    (instanceIds: string[]) => { browseGameLocation(context.api, instanceIds[0]); });

  context.registerAction('game-unmanaged-buttons', 120, 'browse', {},
    context.api.translate('Manually Set Location'),
    (instanceIds: string[]) => { browseGameLocation(context.api, instanceIds[0]); });

  context.registerDashlet('Recently Managed', 2, 2, 175, RecentlyManagedDashlet,
                          undefined, undefined, undefined);

  context.once(() => {
    const onScan = (paths: string[]) => $.gameModeManager.startSearchDiscovery(paths);
    const onSelectPath = (basePath: string): Promise<string> =>
      Promise.resolve(context.api.selectDir({
        defaultPath: basePath,
      }));

    context.registerDialog('game-search-paths', PathSelectionDialog, () => ({
      onScan,
      onSelectPath,
    }));
    const store: Redux.Store<IState> = context.api.store;
    const events = context.api.events;

    // Enhance existing games with macOS compatibility layer
    const enhanceGamesWithMacOSCompatibility = () => {
      console.log(`[Mac Enhancement Debug] Starting enhancement, available games: ${$.extensionGames.length}`);
      console.log(`[Mac Enhancement Debug] Available game IDs:`, $.extensionGames.map(g => g.id));
      console.log(`[Mac Enhancement Debug] Mac fixes to apply:`, MACOS_GAME_FIXES.map(f => f.gameId));
      
      MACOS_GAME_FIXES.forEach(fix => {
        // Only enhance existing bundled or community extensions, never create game stubs
        const existingGame = $.extensionGames.find(game => game.id === fix.gameId);
        
        if (existingGame) {
          // If bundled/community extension exists, enhance it with macOS compatibility info
          log('info', 'enhancing existing extension with macOS compatibility', { 
            gameId: fix.gameId, 
            gameName: existingGame.name 
          });
          
          console.log(`[Mac Enhancement Debug] Enhancing game: ${existingGame.name} (${fix.gameId})`);
          
          // Store the macOS compatibility info in the details property
          if (!existingGame.details) {
            existingGame.details = {};
          }
          if (!existingGame.details.macOSCompatibility) {
            existingGame.details.macOSCompatibility = {
              windowsExecutable: fix.windowsExecutable,
              macOSAppBundle: fix.macOSAppBundle,
              alternativeFiles: fix.alternativeFiles
            };
            console.log(`[Mac Enhancement Debug] Added Mac compatibility to ${existingGame.name}:`, existingGame.details.macOSCompatibility);
          } else {
            console.log(`[Mac Enhancement Debug] Game ${existingGame.name} already has Mac compatibility`);
          }
        } else {
          // Log that we're skipping this game since no proper extension exists
          // This allows community extensions to be downloaded and installed properly
          log('debug', 'skipping macOS compatibility enhancement - no extension found', { 
            gameId: fix.gameId,
            message: 'Waiting for bundled or community extension to be available'
          });
          console.log(`[Mac Enhancement Debug] No extension found for game ID: ${fix.gameId}`);
        }
      });
    };

    // Load discovered games from persistent storage on startup
    loadDiscoveredGames(context.api)
      .then(() => {
        // Register macOS compatibility games before GameModeManager initialization
        enhanceGamesWithMacOSCompatibility();

        const GameModeManagerImpl: typeof GameModeManager = require('./GameModeManager').default;

        context.api.ext['awaitProfileSwitch'] = () => awaitProfileSwitch(context.api);

        $.gameModeManager = new GameModeManagerImpl(
          context.api,
          $.extensionGames,
          $.extensionStubs,
          gameStoreLaunchers,
          (gameMode: string) => {
            log('debug', 'gamemode activated', gameMode);
            events.emit('gamemode-activated', gameMode);
          });
        $.gameModeManager.attachToStore(store);
        
        // Run initial discovery after GameModeManager is initialized
        const { discovered } = store.getState().settings.gameMode;
        const discoveredGames = new Set(
          Object.keys(discovered).filter(gameId => discovered[gameId].path !== undefined));
        return $.gameModeManager.startQuickDiscovery(undefined, false)
          .then(() => removeDisappearedGames(context.api, discoveredGames, $.extensionStubs
            .reduce((prev, stub) => {
              prev[stub.game.id] = stub.ext;
              return prev;
            }, {})));
      })
      .catch(err => {
        log('warn', 'Failed to load persistent discovered games', { error: err.message });
        
        // Register macOS compatibility games before GameModeManager initialization
        enhanceGamesWithMacOSCompatibility();

        const GameModeManagerImpl: typeof GameModeManager = require('./GameModeManager').default;

        context.api.ext['awaitProfileSwitch'] = () => awaitProfileSwitch(context.api);

        $.gameModeManager = new GameModeManagerImpl(
          context.api,
          $.extensionGames,
          $.extensionStubs,
          gameStoreLaunchers,
          (gameMode: string) => {
            log('debug', 'gamemode activated', gameMode);
            events.emit('gamemode-activated', gameMode);
          });
        $.gameModeManager.attachToStore(store);
        
        // Run initial discovery after GameModeManager is initialized
        const { discovered } = store.getState().settings.gameMode;
        const discoveredGames = new Set(
          Object.keys(discovered).filter(gameId => discovered[gameId].path !== undefined));
        return $.gameModeManager.startQuickDiscovery(undefined, false)
          .then(() => removeDisappearedGames(context.api, discoveredGames, $.extensionStubs
            .reduce((prev, stub) => {
              prev[stub.game.id] = stub.ext;
              return prev;
            }, {})));
      });

    // Set up a listener to save discovered games whenever they change
    let previousDiscoveredGames = {};
    context.api.onStateChange(['settings', 'gameMode', 'discovered'], (previous, current) => {
      // Only save if there are actual changes
      if (JSON.stringify(previousDiscoveredGames) !== JSON.stringify(current)) {
        previousDiscoveredGames = current;
        saveDiscoveredGames(context.api);
      }
    });

    context.api.onAsync('discover-game', (gameId: string) => {
      if ($.gameModeManager === undefined) {
        // GameModeManager not initialized yet, return resolved promise
        return Promise.resolve();
      }
      const game = getGame(gameId);
      if (game !== undefined) {
        return $.gameModeManager.startQuickDiscovery([game]);
      } else {
        return Promise.resolve();
      }
    });

    // IMPORTANT: internal event but lacking alternatives, extensions may use it (to refresh
    //    tool discovery). Therefore this must not be changed (breaking change) before Vortex 1.6
    events.on('start-quick-discovery', (cb?: (gameIds: string[]) => void) => {
      const { discovered } = store.getState().settings.gameMode;
      const discoveredGames = new Set(
        Object.keys(discovered).filter(gameId => discovered[gameId].path !== undefined));

      $.gameModeManager.startQuickDiscovery(undefined, false)
        .then((gameIds: string[]) => {
          return removeDisappearedGames(context.api, discoveredGames)
            .then(() => {
              if (cb !== undefined) {
                cb(gameIds);
              }
            });
        })
        .catch(err => {
          err['attachLogOnReport'] = true;
          context.api.showErrorNotification('Discovery failed', err);
          cb?.(Array.from(discoveredGames));
        });
    });
    context.api.onAsync('discover-tools', (gameId: string) => {
      if ($.gameModeManager === undefined) {
        // GameModeManager not initialized yet, return resolved promise
        return Promise.resolve();
      }
      return $.gameModeManager.startToolDiscovery(gameId);
    });
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
      if ($.gameModeManager === undefined) {
        // GameModeManager not initialized yet, nothing to cancel
        return;
      }
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

    events.on('refresh-game-list', (forceFullDiscovery?: boolean) => {
      // Refresh the known games list when game extensions are installed
      if (forceFullDiscovery) {
        // Force a complete refresh including re-reading game extensions
        // Use the extension manager's exposed update function if available
        if (context.api.ext['updateExtensions']) {
          // Add a flag to prevent infinite loop
          if (isRefreshingGameList) {
            // Already refreshing, skip to prevent infinite loop
            return;
          }
          
          // Set the flag to indicate we're refreshing
          isRefreshingGameList = true;
          
          context.api.ext['updateExtensions'](false)
            .then(() => {
              // After updating extensions, we need to ensure game extensions are properly registered
              // Re-initialize the extension games list to capture any newly installed game extensions
              $.extensionGames = [];
              $.extensionStubs = [];
              
              // Get the current state and re-process all installed game extensions
              const state = context.api.getState();
              log('debug', 'Beginning game extension registration sweep');
              const installedExtensions = state.session.extensions?.installed || {};
              
              // Process each installed game extension to ensure it's registered
              return promiseMap(Object.keys(installedExtensions), extId => {
                const ext = installedExtensions[extId];
                // Enhanced condition to process game extensions
                // Process extensions that are explicitly marked as 'game' type
                // OR extensions that appear to be game extensions based on naming conventions
                const isLikelyGameExtension = ext.name && 
                  (ext.name.toLowerCase().startsWith('game:') || 
                   ext.name.toLowerCase().includes('vortex extension') ||
                   ext.name.toLowerCase().includes('game') ||
                   // Additional patterns for common game extension naming conventions
                   ext.name.toLowerCase().includes('mod manager') ||
                   ext.name.toLowerCase().includes('game support') ||
                   ext.name.toLowerCase().includes('game extension') ||
                   // Check if the extension name contains common game-related terms
                   /\b(balatro|skyrim|fallout|witcher|stardew|factorio|rimworld|subnautica|valheim|minecraft|cyberpunk|elden|elden ring|starfield|gta|grand theft auto)\b/i.test(ext.name));
                
                if ((ext.type === 'game' || isLikelyGameExtension) && ext.path) {
                  log('debug', 'Processing potential game extension', { 
                    extensionName: ext.name,
                    extensionType: ext.type,
                    isLikelyGameExtension,
                    path: ext.path
                  });
                  
                  try {
                    // Try to load and register the game extension
                    const indexPath = path.join(ext.path, 'index.js');
                    return fs.statAsync(indexPath)
                      .then(() => {
                        log('debug', 'Found extension index file', { indexPath });
                        
                        // Clear module cache to ensure we get the latest version
                        delete require.cache[indexPath];
                        
                        const extensionModule = require(indexPath);
                        // Check if the module has a default export or a main function
                        // Enhanced to handle various export patterns
                        const initFunction = extensionModule.default || 
                                           extensionModule.main || 
                                           extensionModule.init ||
                                           extensionModule.initialize ||
                                           extensionModule.activate ||
                                           extensionModule.load ||
                                           extensionModule.setup ||
                                           (typeof extensionModule === 'function' ? extensionModule : null);
                        
                        if (typeof initFunction === 'function') {
                          log('debug', 'Found valid init function in extension', { 
                            extensionName: ext.name,
                            initFunctionType: typeof initFunction,
                            hasDefault: !!extensionModule.default,
                            hasMain: !!extensionModule.main,
                            hasInit: !!extensionModule.init,
                            hasInitialize: !!extensionModule.initialize,
                            hasActivate: !!extensionModule.activate
                          });
                          
                          // Create a minimal context for the extension to register its game
                          const onceCallbacks: Array<() => void> = [];
                          const contextProxy = new Proxy({
                            api: context.api,
                            registerGame: (game: IGame) => {
                              // Register the game in our extension games list
                              game.extensionPath = ext.path;
                              $.extensionGames.push(game);
                              log('debug', 'Game registered by extension', { 
                                gameName: game.name,
                                gameId: game.id,
                                extensionName: ext.name
                              });
                            },
                            registerGameStub: (game: IGame, extInfo: IExtensionDownloadInfo) => {
                              // Handle game stubs if needed
                              $.extensionStubs.push({ ext: extInfo, game });
                              log('debug', 'Game stub registered by extension', { 
                                gameName: game.name,
                                extensionName: ext.name
                              });
                            },
                            once: (callback: () => void) => {
                              // Queue the callback to be executed after the extension is loaded
                              onceCallbacks.push(callback);
                              log('debug', 'Queued once callback for extension', { extensionName: ext.name });
                            }
                          }, {
                            get: (target, prop) => {
                              // Provide stub functions for other register methods
                              if (prop === 'registerGame' || prop === 'registerGameStub' || prop === 'once') {
                                return target[prop];
                              } else if (typeof prop === 'string' && prop.startsWith('register')) {
                                log('debug', 'Providing stub for register method', { method: prop });
                                return () => {}; // Stub for other register methods
                              }
                              // Handle other common extension context properties
                              if (prop === 'api') {
                                return target.api;
                              }
                              if (prop === 'optional') {
                                return {
                                  registerGame: () => {},
                                  registerGameStub: () => {},
                                  registerModType: () => {},
                                  // Add other common optional methods as needed
                                };
                              }
                              return target[prop];
                            }
                          });
                          
                          // Call the extension's init function
                          try {
                            const result = initFunction(contextProxy);
                            // Handle Promise return values
                            if (result && typeof result.then === 'function') {
                              log('debug', 'Extension init function returned promise', { extensionName: ext.name });
                              return result.then(() => {
                                log('debug', 'Extension init function completed successfully', { extensionName: ext.name });
                                // Execute any queued once callbacks after the init function completes
                                onceCallbacks.forEach(callback => {
                                  try {
                                    callback();
                                    log('debug', 'Executed once callback successfully', { extensionName: ext.name });
                                  } catch (err) {
                                    log('warn', 'Error in extension once callback', { extension: ext.name, error: err.message });
                                  }
                                });
                              }).catch((err) => {
                                log('warn', 'Error in extension init function', { extension: ext.name, error: err.message });
                                // Still execute once callbacks even if init function fails
                                onceCallbacks.forEach(callback => {
                                  try {
                                    callback();
                                    log('debug', 'Executed once callback after init failure', { extensionName: ext.name });
                                  } catch (callbackErr) {
                                    log('warn', 'Error in extension once callback after init failure', { 
                                      extension: ext.name, 
                                      error: callbackErr.message 
                                    });
                                  }
                                });
                              });
                            } else {
                              log('debug', 'Extension init function completed synchronously', { extensionName: ext.name });
                              // Execute any queued once callbacks immediately for synchronous init functions
                              onceCallbacks.forEach(callback => {
                                try {
                                  callback();
                                  log('debug', 'Executed once callback successfully', { extensionName: ext.name });
                                } catch (err) {
                                  log('warn', 'Error in extension once callback', { extension: ext.name, error: err.message });
                                }
                              });
                              return Promise.resolve();
                            }
                          } catch (initErr) {
                            log('warn', 'Error calling extension init function', { extension: ext.name, error: initErr.message, stack: initErr.stack });
                            // Still execute once callbacks even if init function throws
                            onceCallbacks.forEach(callback => {
                              try {
                                callback();
                                log('debug', 'Executed once callback after init error', { extensionName: ext.name });
                              } catch (callbackErr) {
                                log('warn', 'Error in extension once callback after init error', { 
                                  extension: ext.name, 
                                  error: callbackErr.message 
                                });
                              }
                            });
                            return Promise.resolve();
                          }
                        } else {
                          log('warn', 'Extension module does not export a valid init function', { extension: ext.name, indexPath });
                          return Promise.resolve();
                        }
                      })
                      .catch((err) => {
                        // File doesn't exist or other error, log and skip this extension
                        log('warn', 'Failed to load game extension file', { extension: ext.name, path: indexPath, error: err.message });
                        return Promise.resolve();
                      });
                  } catch (err) {
                    log('warn', 'Failed to load game extension', { extension: ext.name, error: err.message });
                    return Promise.resolve();
                  }
                }
                return Promise.resolve();
              })
              .then(() => {
                // Enhance newly loaded extensions with macOS compatibility
                enhanceGamesWithMacOSCompatibility();
                
                // Refresh the known games with the updated extension games list
                const gamesStored: IGameStored[] = $.extensionGames
                  .map(game => ({
                    name: game.name,
                    shortName: game.shortName,
                    id: game.id,
                    logo: game.logo,
                    extensionPath: game.extensionPath,
                    contributed: game.contributed,
                    final: game.final,
                    version: game.version,
                    executable: game.executable?.(),
                    requiredFiles: game.requiredFiles,
                    environment: game.environment,
                    details: game.details,
                  }))
                  .filter(game => 
                    (game.executable !== undefined) &&
                    (game.requiredFiles !== undefined) &&
                    (game.name !== undefined)
                  );
                context.api.store.dispatch(setKnownGames(gamesStored));
                
                log('info', 'Refreshed known games list', { 
                  gameCount: gamesStored.length,
                  games: gamesStored.map(g => g.name)
                });
                
                // Also run quick discovery to find the game paths
                if ($.gameModeManager === undefined) {
                  // GameModeManager not initialized yet, defer discovery until it's ready
                  log('info', 'GameModeManager not yet initialized, deferring discovery');
                  // Set up a one-time listener to run discovery when GameModeManager is ready
                  const runDiscoveryWhenReady = () => {
                    if ($.gameModeManager !== undefined) {
                      log('info', 'GameModeManager now ready, running deferred discovery');
                      $.gameModeManager.startQuickDiscovery(undefined, false)
                        .then((gameIds) => {
                          log('info', 'Deferred discovery completed', { discoveredGames: gameIds });
                        })
                        .catch(err => log('warn', 'Deferred discovery failed', { error: err.message }));
                    } else {
                      // Try again in a short while
                      setTimeout(runDiscoveryWhenReady, 100);
                    }
                  };
                  setTimeout(runDiscoveryWhenReady, 100);
                  return Promise.resolve([] as string[]);
                }
                return $.gameModeManager.startQuickDiscovery(undefined, false)
                  .then((gameIds) => {
                    log('info', 'Quick discovery completed', { discoveredGames: gameIds });
                    return gameIds;
                  });
              }).then(() => {
                log('debug', 'Completed game extension registration sweep');
              });
            })
            .then(() => {
              log('info', 'Game list fully refreshed after extension installation');
              // Clear the flag when done
              isRefreshingGameList = false;
            })
            .catch(err => {
              log('error', 'Failed to refresh game list', err.message);
              // Clear the flag on error
              isRefreshingGameList = false;
            });
        } else {
          // Fallback if the update function is not available
          const gamesStored: IGameStored[] = $.extensionGames
            .map(game => ({
              name: game.name,
              shortName: game.shortName,
              id: game.id,
              logo: game.logo,
              extensionPath: game.extensionPath,
              contributed: game.contributed,
              final: game.final,
              version: game.version,
              executable: game.executable?.(),
              requiredFiles: game.requiredFiles,
              environment: game.environment,
              details: game.details,
            }))
            .filter(game => 
              (game.executable !== undefined) &&
              (game.requiredFiles !== undefined) &&
              (game.name !== undefined)
            );
          context.api.store.dispatch(setKnownGames(gamesStored));
          log('info', 'Game list refreshed after extension installation');
        }
      } else {
        const gamesStored: IGameStored[] = $.extensionGames
          .map(game => ({
            name: game.name,
            shortName: game.shortName,
            id: game.id,
            logo: game.logo,
            extensionPath: game.extensionPath,
            contributed: game.contributed,
            final: game.final,
            version: game.version,
            executable: game.executable?.(),
            requiredFiles: game.requiredFiles,
            environment: game.environment,
            details: game.details,
          }))
          .filter(game => 
            (game.executable !== undefined) &&
            (game.requiredFiles !== undefined) &&
            (game.name !== undefined)
          );
        context.api.store.dispatch(setKnownGames(gamesStored));
        log('info', 'Game list refreshed after extension installation');
      }
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
      if ($.gameModeManager === undefined) {
        // GameModeManager not initialized yet, return resolved promise
        return Promise.resolve();
      }
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
        .then(() =>
          $.gameModeManager.setGameMode(oldGameId, newGameId, currentProfileId))
        .catch((err) => {
          if ((err instanceof UserCanceled) || (err instanceof ProcessCanceled)) {
            // nop
          } else if ((err instanceof SetupError)
                    || (err instanceof DataInvalid)) {
            showError(store.dispatch, 'Failed to set game mode', err, {
              allowReport: false, message: newGameId, id: 'failed-to-set-gamemode' });
          } else {
            if (err.code === 'ENOENT') {
              context.api.sendNotification({
                message: 'Failed to set game mode',
                type: 'error',
                actions: [
                  {
                    title: 'More',
                    action: (dismiss) => {
                      context.api.showDialog('error', 'Failed to set game mode', {
                        bbcode: context.api.translate('Vortex attempted to manage the game and has '
                          + 'encountered a missing file:[br][/br]"{{errPath}}".[br][/br][br][/br]'
                          + 'Depending on recent changes on your environment and/or the game store through '
                          + 'which the game has been purchased, this error could be due to several factors:[br][/br][list]'
                          + '[*]The game might be only partially installed/uninstalled or in a corrupt state'
                          + '[*]The game store through which you purchased the game might require additional steps '
                          + 'to enable modding capabilities'
                          + '[*]You may have to run the game at least once for certain folders to be created/unlocked'
                          + '[*]You might have installed an unrecognized game variant. Please inform the game extension developer[/list]',
                            { replace: { errPath: err.path } }),
                      },
                      [
                        { label: 'Close' },
                      ]);
                    },
                  }],
              });
            } else {
              err['attachLogOnReport'] = true;
              showError(store.dispatch, 'Failed to set game mode', err, {
                message: newGameId, id: 'failed-to-set-gamemode',
              });
            }
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
      const { commandLine } = store.getState().session.base;
      if ((profile !== undefined)
          && (commandLine.game === undefined)
          && (commandLine.profile === undefined)) {
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
    
    // Initialize the game discovery service
    const discoveryService = new GameDiscoveryService(context.api);
    
    // Start discovery at application launch
    discoveryService.startDiscovery(
      (progress) => {
        // Progress callback - this is handled by the Redux actions
      },
      (results) => {
        // Completion callback - log the results
        log('info', 'Game discovery completed', { 
          discoveredGames: results.length,
          results: results.map(r => ({ 
            gameId: r.gameId, 
            gameName: r.gameName, 
            enhanced: r.enhanced 
          }))
        });
      }
    );
  });

  return true;
}

export default init;
