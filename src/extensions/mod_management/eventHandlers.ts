import {IExtensionApi} from '../../types/IExtensionContext';
import {IStatePaths} from '../../types/IState';
import {showError} from '../../util/message';
import {getSafe} from '../../util/storeHelper';
import {truthy} from '../../util/util';

import {IDownload} from '../download_management/types/IDownload';
import {activeGameId, activeProfile} from '../profile_management/selectors';
import {addMod, removeMod} from './actions/mods';
import {setActivator} from './actions/settings';
import {IMod} from './types/IMod';
import {IModActivator} from './types/IModActivator';
import {loadActivation, saveActivation} from './util/activationStore';

import {currentGameDiscovery} from '../gamemode_management/selectors';
import {setModEnabled} from '../profile_management/actions/profiles';

import refreshMods from './util/refreshMods';
import resolvePath from './util/resolvePath';
import supportedActivators from './util/supportedActivators';

import InstallManager from './InstallManager';
import {currentActivator, installPath} from './selectors';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';

export function onGameModeActivated(
    api: IExtensionApi, activators: IModActivator[], newGame: string) {
  const store = api.store;
  const state = store.getState();
  const configuredActivatorId = currentActivator(state);
  const supported = supportedActivators(activators, state);
  const configuredActivator =
    supported.find(activator => activator.id === configuredActivatorId);
  const gameDiscovery = currentGameDiscovery(state);

  const instPath = installPath(state);

  if (configuredActivator === undefined) {
    // current activator is not valid for this game. This should only occur
    // if compatibility of the activator has changed

    const oldActivator = activators.find(iter => iter.id === configuredActivatorId);

    if ((configuredActivatorId !== undefined) && (oldActivator === undefined)) {
      api.showErrorNotification(
        'Deployment method "' + configuredActivatorId + '" no longer available',
        'The deployment method used with this game is no longer available. ' +
        'This probably means you removed the corresponding extension or ' +
        'it can no longer be loaded due to a bug.\n' +
        'Vortex can\'t clean up files deployed with an unsupported method. ' +
        'You should try to restore it, purge deployment and then switch ' +
        'to a different method.');
    } else {
      const purgePromise = oldActivator !== undefined
        ? oldActivator.purge(instPath, gameDiscovery.modPath)
        : Promise.resolve();

      purgePromise.then(() => {
        if (supported.length > 0) {
          api.store.dispatch(
            setActivator(newGame, supported[0].id));
        }
      });
    }
  }

  const knownMods = Object.keys(getSafe(state, ['persistent', 'mods', newGame], {}));
  refreshMods(instPath, knownMods, (mod: IMod) => {
    api.store.dispatch(addMod(newGame, mod));
  }, (modNames: string[]) => {
    modNames.forEach((name: string) => {
      api.store.dispatch(removeMod(newGame, name));
    });
  })
    .then(() => {
      api.events.emit('mods-refreshed');
      return null;
    })
    .catch((err: Error) => {
      showError(store.dispatch, 'Failed to refresh mods', err);
    });
}

export function onPathsChanged(api: IExtensionApi,
                               previous: { [gameId: string]: IStatePaths },
                               current: { [gameId: string]: IStatePaths }) {
  const store = api.store;
  const state = store.getState();
  const gameMode = activeGameId(state);
  if (previous[gameMode] !== current[gameMode]) {
    const knownMods = Object.keys(state.persistent.mods[gameMode]);
    refreshMods(installPath(state), knownMods, (mod: IMod) =>
      api.store.dispatch(addMod(gameMode, mod))
      , (modNames: string[]) => {
        modNames.forEach((name: string) =>
          api.store.dispatch(removeMod(gameMode, name)));
      })
      .then(() => null)
      .catch((err: Error) => {
        showError(store.dispatch, 'Failed to refresh mods', err);
      });
  }
}

export function onRemoveMod(api: IExtensionApi,
                            activators: IModActivator[],
                            gameMode: string,
                            modId: string,
                            callback?: (error: Error) => void) {
  const store = api.store;
  const state = store.getState();
  let mod: IMod;

  try {
    const mods = state.persistent.mods[gameMode];
    mod = mods[modId];
  } catch (err) {
    callback(err);
  }

  // we need to remove the mod from activation, otherwise me might leave orphaned
  // links in the mod directory
  const profileId =
    getSafe(state, ['settings', 'profiles', 'lastActiveProfile', gameMode], undefined);
  const profile = getSafe(state, ['persistent', 'profiles', profileId], undefined);

  store.dispatch(setModEnabled(profile.id, modId, false));

  const activatorId = getSafe(state, ['settings', 'mods', 'activator', gameMode], undefined);
  const activator: IModActivator = activatorId !== undefined
    ? activators.find(act => act.id === activatorId)
    : activators.find(act => act.isSupported(state, gameMode) === undefined);

  const installationPath = resolvePath('install', state.settings.mods.paths, gameMode);

  // remove from state first, otherwise if the deletion takes some time it will appear as if nothing
  // happened
  store.dispatch(removeMod(gameMode, modId));

  const gameDiscovery = getSafe(state, ['settings', 'gameMode', 'discovered', gameMode], undefined);
  if (gameDiscovery === undefined) {
    // if the game hasn't been discovered we can't deploy, but that's not really a big problem
    return callback(null);
  }

  const dataPath = gameDiscovery.modPath;
  loadActivation(api, dataPath)
    .then(lastActivation => activator.prepare(
      dataPath, false, lastActivation))
    .then(() => mod !== undefined
      ? activator.deactivate(installationPath, dataPath, mod)
      : Promise.resolve())
    .then(() => activator.finalize(dataPath))
    .then(newActivation => saveActivation(state.app.instanceId, dataPath, newActivation))
    .then(() => truthy(mod)
      ? fs.removeAsync(path.join(installationPath, mod.installationPath))
          .catch(err => err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err))
      : Promise.resolve())
    .then(() => {
      callback(null);
    })
    .catch(err => callback(err));
}

export function onStartInstallDownload(api: IExtensionApi,
                                       installManager: InstallManager,
                                       downloadId: string,
                                       callback?: (error, id: string) => void) {
  const store = api.store;
  const state = store.getState();
  const download: IDownload = state.persistent.downloads.files[downloadId];
  const inPaths = state.settings.mods.paths;
  const downloadPath: string = resolvePath('download', inPaths, download.game);
  const fullPath: string = path.join(downloadPath, download.localPath);
  installManager.install(downloadId, fullPath, download.game, api,
    download.modInfo, true, false, callback);
}
