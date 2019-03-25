import {IExtensionApi} from '../../types/IExtensionContext';
import {IModTable, IState} from '../../types/IState';
import { ProcessCanceled, TemporaryError, UserCanceled } from '../../util/CustomErrors';
import * as fs from '../../util/fs';
import getNormalizeFunc, { Normalize } from '../../util/getNormalizeFunc';
import { log } from '../../util/log';
import {showError} from '../../util/message';
import { downloadPathForGame } from '../../util/selectors';
import {getSafe} from '../../util/storeHelper';
import {truthy} from '../../util/util';

import {IDownload} from '../download_management/types/IDownload';
import {activeGameId} from '../profile_management/selectors';

import { setDeploymentNecessary } from './actions/deployment';
import {addMod, removeMod} from './actions/mods';
import {setActivator} from './actions/settings';
import {IDeploymentMethod} from './types/IDeploymentMethod';
import {IMod} from './types/IMod';
import {fallbackPurge, loadActivation, saveActivation} from './util/activationStore';
import { getSupportedActivators } from './util/deploymentMethods';

import {getGame} from '../gamemode_management/util/getGame';
import {setModEnabled} from '../profile_management/actions/profiles';
import {IProfile} from '../profile_management/types/IProfile';

import { setInstallPath } from './actions/settings';
import allTypesSupported from './util/allTypesSupported';
import { genSubDirFunc } from './util/deploy';
import queryGameId from './util/queryGameId';
import refreshMods from './util/refreshMods';

import InstallManager from './InstallManager';
import {currentActivator, installPath, installPathForGame} from './selectors';

import * as Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import * as path from 'path';
import { generate as shortid } from 'shortid';

const app = remote !== undefined ? remote.app : appIn;

export const STAGING_DIR_TAG = '__vortex_staging_folder';

function writeStagingTag(api: IExtensionApi, tagPath: string, gameId: string) {
  const state: IState = api.store.getState();
  const data = {
    instance: state.app.instanceId,
    game: gameId,
  };
  return fs.writeFileAsync(tagPath, JSON.stringify(data), {  encoding: 'utf8' });
}

function validateStagingTag(api: IExtensionApi, tagPath: string): Promise<void> {
  return fs.readFileAsync(tagPath, { encoding: 'utf8' })
    .then(data => {
      const state: IState = api.store.getState();
      const tag = JSON.parse(data);
      if (tag.instance !== state.app.instanceId) {
        return api.showDialog('question', 'Confirm', {
          text: 'This is a staging folder but it appears to belong to a different Vortex '
              + 'instance. If you\'re using Vortex in shared and "regular" mod, do not use '
              + 'the same staging folder for both!',
        }, [
          { label: 'Cancel' },
          { label: 'Continue' },
        ])
        .then(result => (result.action === 'Cancel')
          ? Promise.reject(new UserCanceled())
          : Promise.resolve());
      }
      return Promise.resolve();
    })
    .catch(() => {
      return api.showDialog('question', 'Confirm', {
        text: 'This directory is not marked as a staging folder. '
            + 'Are you *sure* it\'s the right directory?',
      }, [
        { label: 'Cancel' },
        { label: 'I\'m sure' },
      ])
      .then(result => result.action === 'Cancel'
        ? Promise.reject(new UserCanceled())
        : Promise.resolve());
    });
}

export function onGameModeActivated(
    api: IExtensionApi, activators: IDeploymentMethod[], newGame: string) {
  const store = api.store;
  const state: IState = store.getState();
  const configuredActivatorId = currentActivator(state);
  const supported = getSupportedActivators(state);
  const configuredActivator =
    supported.find(activator => activator.id === configuredActivatorId);
  const gameId = activeGameId(state);
  if (gameId !== newGame) {
    // this should never happen
    api.showErrorNotification('Event was triggered with incorrect parameter',
      new Error(`game id mismatch "${newGame}" vs "${gameId}"`));
  }
  const gameDiscovery = state.settings.gameMode.discovered[gameId];
  const game = getGame(gameId);

  if ((gameDiscovery === undefined)
      || (gameDiscovery.path === undefined)
      || (game === undefined)) {
    return;
  }

  let instPath = installPath(state);

  const ensureStagingDirectory = () => fs.statAsync(instPath)
    .catch(err =>
      api.showDialog('error', 'Mod Staging Folder missing!', {
        text: 'Your mod staging folder (see below) is missing. This might happen because you '
            + 'deleted it or - if you have it on a removable drive - it is not currently '
            + 'connected.\nIf you continue now, a new staging folder will be created but all '
            + 'your previously managed mods will be lost.\n\n'
            + 'If you have moved the folder or the drive letter changed, you can browse '
            + 'for the new location manually, but please be extra careful to select the right '
            + 'folder!',
        message: instPath,
      }, [
        { label: 'Quit Vortex' },
        { label: 'Reinitialize' },
        { label: 'Browse...' },
      ])
      .then(dialogResult => {
        if (dialogResult.action === 'Quit Vortex') {
          app.exit(0);
          return Promise.reject(new UserCanceled());
        } else if (dialogResult.action === 'Reinitialize') {
          const id = shortid();
          api.sendNotification({
            id,
            type: 'activity',
            message: 'Purging mods',
          });
          return fallbackPurge(api)
            .then(() => fs.ensureDirWritableAsync(instPath, () => Promise.resolve()))
            .catch((err) => {
              if (err instanceof ProcessCanceled) {
                log('warn', 'Mods not purged', err.message);
              } else {
              api.showDialog('error', 'Mod Staging Folder missing!', {
                bbcode: 'The staging folder could not be created. '
                      + 'You [b][color=red]have[/color][/b] to go to settings->mods and change it '
                      + 'to a valid directory [b][color=red]before doing anything else[/color][/b] '
                      + 'or you will get further error messages.',
              }, [
                { label: 'Close' },
              ]);
              }
              throw new ProcessCanceled('not purged');
            })
            .finally(() => {
              api.dismissNotification(id);
            });
        } else { // Browse...
          return api.selectDir({
            defaultPath: instPath,
            title: api.translate('Select staging folder'),
          })
            .then((selectedPath) => {
              if (!truthy(selectedPath)) {
                return Promise.reject(new UserCanceled());
              }
              return validateStagingTag(api, path.join(selectedPath, STAGING_DIR_TAG))
                .then(() => {
                  instPath = selectedPath;
                  store.dispatch(setInstallPath(gameId, instPath));
                });
            })
            .catch(() => ensureStagingDirectory());
        }
      }))
      .then(() => writeStagingTag(api, path.join(instPath, STAGING_DIR_TAG), gameId));

  let activatorProm = ensureStagingDirectory();

  if (configuredActivator === undefined) {
    // current activator is not valid for this game. This should only occur
    // if compatibility of the activator has changed

    const oldActivator = activators.find(iter => iter.id === configuredActivatorId);

    if ((configuredActivatorId !== undefined) && (oldActivator === undefined)) {
      api.showErrorNotification(
        'Deployment method no longer available',
        {
          message:
          'The deployment method used with this game is no longer available. ' +
          'This probably means you removed the corresponding extension or ' +
          'it can no longer be loaded due to a bug.\n' +
          'Vortex can\'t clean up files deployed with an unsupported method. ' +
          'You should try to restore it, purge deployment and then switch ' +
          'to a different method.',
          method: configuredActivatorId,
        }, { allowReport: false });
    } else {
      const modPaths = game.getModPaths(gameDiscovery.path);
      if (oldActivator !== undefined) {
        activatorProm = activatorProm
          .then(() => oldActivator.prePurge(instPath))
          .then(() => Promise.mapSeries(Object.keys(modPaths),
            typeId => oldActivator.purge(instPath, modPaths[typeId]))
              .then(() => undefined)
              .catch(TemporaryError, err =>
                  api.showErrorNotification('Purge failed, please try again',
                    err.message, { allowReport: false }))
              .catch(err => api.showErrorNotification('Purge failed', err, {
                allowReport: ['ENOENT', 'ENOTFOUND'].indexOf(err.code) !== -1,
              })))
          .finally(() => oldActivator.postPurge());
      }

      activatorProm = activatorProm.then(() => {
        if (supported.length > 0) {
          api.store.dispatch(
            setActivator(gameId, supported[0].id));
        }
      });
    }
  }

  const knownMods: { [modId: string]: IMod } = getSafe(state, ['persistent', 'mods', gameId], {});
  activatorProm
    .then(() => refreshMods(api, instPath, Object.keys(knownMods), (mod: IMod) => {
      api.store.dispatch(addMod(gameId, mod));
    }, (modNames: string[]) => {
      modNames.forEach((name: string) => {
        if (['downloaded', 'installed'].indexOf(knownMods[name].state) !== -1) {
          api.store.dispatch(removeMod(gameId, name));
        }
      });
    }))
    .then(() => {
      api.events.emit('mods-refreshed');
      return null;
    })
    .catch(UserCanceled, () => undefined)
    .catch(ProcessCanceled, err => {
      log('warn', 'Failed to refresh mods', err.message);
    })
    .catch((err: Error) => {
      showError(store.dispatch, 'Failed to refresh mods', err,
                { allowReport: (err as any).code !== 'ENOENT' });
    });
}

export function onPathsChanged(api: IExtensionApi,
                               previous: { [gameId: string]: string },
                               current: { [gameId: string]: string }) {
  const { store } = api;
  const state = store.getState();
  const gameMode = activeGameId(state);
  if (previous[gameMode] !== current[gameMode]) {
    const knownMods = state.persistent.mods[gameMode];
    refreshMods(api, installPath(state), Object.keys(knownMods || {}), (mod: IMod) =>
      store.dispatch(addMod(gameMode, mod))
      , (modNames: string[]) => {
        modNames.forEach((name: string) => {
          if (['downloaded', 'installed'].indexOf(knownMods[name].state) !== -1) {
            store.dispatch(removeMod(gameMode, name));
          }
        });
      })
      .then(() => null)
      .catch((err: Error) => {
        showError(store.dispatch, 'Failed to refresh mods', err);
      });
  }
}

export function onModsChanged(api: IExtensionApi, previous: IModTable, current: IModTable) {
  const { store } = api;
  const state: IState = store.getState();
  const gameMode = activeGameId(state);

  const rulesOrOverridesChanged = modId =>
    (getSafe(previous, [gameMode, modId], undefined) !== undefined)
    && ((previous[gameMode][modId].rules !== current[gameMode][modId].rules)
        || (previous[gameMode][modId].fileOverrides !== current[gameMode][modId].fileOverrides));

  if ((previous[gameMode] !== current[gameMode])
      && !state.persistent.deployment.needToDeploy[gameMode]) {
    if (Object.keys(current[gameMode]).find(rulesOrOverridesChanged) !== undefined) {
      store.dispatch(setDeploymentNecessary(gameMode, true));
    }
  }
}

function undeploy(api: IExtensionApi,
                  activators: IDeploymentMethod[],
                  gameMode: string,
                  mod: IMod): Promise<void> {
  const store = api.store;
  const state: IState = store.getState();

  const discovery = state.settings.gameMode.discovered[gameMode];

  if ((discovery === undefined) || (discovery.path === undefined)) {
    // if the game hasn't been discovered we can't deploy, but that's not really a problem
    return Promise.resolve();
  }

  const game = getGame(gameMode);
  const modPaths = game.getModPaths(discovery.path);
  const modTypes = Object.keys(modPaths);

  const activatorId = getSafe(state, ['settings', 'mods', 'activator', gameMode], undefined);
  // TODO: can only use one activator that needs to support the whole game
  const activator: IDeploymentMethod = activatorId !== undefined
    ? activators.find(act => act.id === activatorId)
    : activators.find(act => allTypesSupported(act, state, gameMode, modTypes) === undefined);

  if (activator === undefined) {
    return Promise.reject(new ProcessCanceled('No deployment method active'));
  }

  const stagingPath = installPathForGame(state, gameMode);

  const subdir = genSubDirFunc(game);
  const deployPath = modPaths[mod.type || ''];
  if (deployPath === undefined) {
    return Promise.resolve();
  }
  let normalize: Normalize;
  return getNormalizeFunc(deployPath)
    .then(norm => {
      normalize = norm;
      return loadActivation(api, mod.type, deployPath, stagingPath, activatorId);
    })
    .then(lastActivation => activator.prepare(deployPath, false, lastActivation, normalize))
    .then(() => (mod !== undefined)
      ? activator.deactivate(path.join(stagingPath, mod.installationPath), subdir(mod))
      : Promise.resolve())
    .tapCatch(() => {
      if (activator.cancel !== undefined) {
        activator.cancel(gameMode, deployPath, stagingPath);
      }
    })
    .then(() => activator.finalize(gameMode, deployPath, stagingPath))
    .then(newActivation =>
      saveActivation(mod.type, state.app.instanceId, deployPath, stagingPath, newActivation, activator.id));
}

export function onRemoveMod(api: IExtensionApi,
                            activators: IDeploymentMethod[],
                            gameMode: string,
                            modId: string,
                            callback?: (error: Error) => void) {
  const store = api.store;
  const state: IState = store.getState();

  const modState = getSafe(state, ['persistent', 'mods', gameMode, modId, 'state'], undefined);
  if (['downloaded', 'installed'].indexOf(modState) === -1) {
    if (callback !== undefined) {
      callback(new ProcessCanceled('Can\'t delete mod during download or install'));
    }
    return;
  }

  // we need to remove the mod from activation, otherwise me might leave orphaned
  // links in the mod directory
  let profileId: string;
  const lastActive = getSafe(state,
    ['settings', 'profiles', 'lastActiveProfile', gameMode], undefined);
  if (lastActive !== undefined) {
    profileId = (typeof(lastActive) === 'string')
      ? lastActive
      : lastActive.profileId;
  }
  const profile: IProfile = getSafe(state, ['persistent', 'profiles', profileId], undefined);

  store.dispatch(setModEnabled(profileId, modId, false));

  const installationPath = installPathForGame(state, gameMode);

  let mod: IMod;

  try {
    const mods = state.persistent.mods[gameMode];
    mod = mods[modId];
  } catch (err) {
    if (callback !== undefined) {
      callback(err);
    } else {
      api.showErrorNotification('Failed to remove mod', err);
    }
    return;
  }

  if (mod === undefined) {
    if (callback !== undefined) {
      callback(null);
    }
    return;
  }

  // TODO: no indication anything is happening until undeployment was successful.
  //   we used to remove the mod right away but then if undeployment failed the mod was gone
  //   anyway

  const undeployMod = () => {
    return undeploy(api, activators, gameMode, mod)
      .catch({ code: 'ENOTFOUND' }, err => {
        return api.showDialog('error', 'Mod not found', {
          text: 'The mod you\'re removing has already been deleted on disk.\n'
              + 'This makes it impossible for Vortex to cleanly undeploy the mod '
              + 'so you may be left with files left over in your game directory.\n'
              + 'You should allow Vortex to do a full deployment now to try and '
              + 'clean up as best as possible.\n'
              + 'The mod will be removed after deployment is finished.',
        }, [
          { label: 'Ignore' },
          { label: 'Deploy' },
        ])
          .then(result => {
            if (result.action === 'Deploy') {
              return new Promise((resolve, reject) => {
                api.events.emit('deploy-mods', (deployErr) => {
                  if (deployErr !== null) {
                    return reject(deployErr);
                  }
                  return resolve();
                });
              });
            } else {
              return Promise.resolve();
            }
          });
      });
  };

  undeployMod()
  .then(() => truthy(mod)
    ? fs.removeAsync(path.join(installationPath, mod.installationPath))
        .catch(err => err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err))
    : Promise.resolve())
  .then(() => {
    store.dispatch(removeMod(gameMode, mod.id));
    if (callback !== undefined) {
      callback(null);
    }
  })
  .catch(TemporaryError, (err) => {
    if (callback !== undefined) {
      callback(err);
    } else {
      api.showErrorNotification('Failed to undeploy mod, please try again',
        err.message, { allowReport: false });
    }
  })
  .catch(ProcessCanceled, (err) => {
    if (callback !== undefined) {
      callback(err);
    } else {
      api.showErrorNotification('Failed to remove mod', err.message, { allowReport: false });
    }
  })
  .catch(UserCanceled, err => {
    if (callback !== undefined) {
      callback(err);
    }
  })
  .catch(err => {
    if (callback !== undefined) {
      callback(err);
    } else {
      api.showErrorNotification('Failed to remove mod', err);
    }
  });
}

export function onAddMod(api: IExtensionApi, gameId: string,
                         mod: IMod, callback: (err: Error) => void) {
  const store = api.store;
  const state: IState = store.getState();

  const installationPath = installPathForGame(state, gameId);

  store.dispatch(addMod(gameId, mod));
  fs.ensureDirAsync(path.join(installationPath, mod.installationPath))
  .then(() => {
    callback(null);
  })
  .catch(err => {
    callback(err);
  });
}

export function onStartInstallDownload(api: IExtensionApi,
                                       installManager: InstallManager,
                                       downloadId: string,
                                       callback?: (error, id: string) => void): Promise<void> {
  const store = api.store;
  const state: IState = store.getState();
  const download: IDownload = state.persistent.downloads.files[downloadId];
  if (download === undefined) {
    api.showErrorNotification('Unknown Download',
      'Sorry, I was unable to identify the archive this mod was installed from. '
      + 'Please reinstall by installing the file from the downloads tab.', {
        allowReport: false,
      });
    return Promise.resolve();
  }

  return queryGameId(api.store, download.game)
    .then(gameId => {
      if (!truthy(download.localPath)) {
        api.events.emit('refresh-downloads', gameId, () => {
          api.showErrorNotification('Download invalid',
            'Sorry, the meta data for this download is incomplete. Vortex has '
            + 'tried to refresh it, please try again.',
            { allowReport: false });
        });
        return Promise.resolve();
      }

      const downloadGame: string = Array.isArray(download.game) ? download.game[0] : download.game;
      const downloadPath: string = downloadPathForGame(state, downloadGame);
      if (downloadPath === undefined) {
        api.showErrorNotification('Unknown Game',
          'Failed to determine installation directory. This shouldn\'t have happened', {
            allowReport: true,
          });
        return;
      }
      const fullPath: string = path.join(downloadPath, download.localPath);
      installManager.install(downloadId, fullPath, download.game, api,
        { download }, true, false, callback, gameId);
    })
    .catch(err => {
      if (callback !== undefined) {
        callback(err, undefined);
      } else if (!(err instanceof UserCanceled)) {
        api.showErrorNotification('Failed to start download', err);
      }
    });
}
