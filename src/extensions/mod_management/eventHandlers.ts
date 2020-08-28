import { startActivity, stopActivity } from '../../actions/session';
import { IDialogResult } from '../../types/IDialog';
import {IExtensionApi} from '../../types/IExtensionContext';
import {IModTable, IProfile, IState} from '../../types/IState';
import { ProcessCanceled, TemporaryError, UserCanceled } from '../../util/CustomErrors';
import { setErrorContext } from '../../util/errorHandling';
import * as fs from '../../util/fs';
import getNormalizeFunc, { Normalize } from '../../util/getNormalizeFunc';
import { log } from '../../util/log';
import {showError} from '../../util/message';
import { downloadPathForGame } from '../../util/selectors';
import {getSafe} from '../../util/storeHelper';
import {truthy} from '../../util/util';

import {IDownload} from '../download_management/types/IDownload';
import {activeGameId, activeProfile} from '../profile_management/selectors';

import { setDeploymentNecessary } from './actions/deployment';
import {addMod, removeMod} from './actions/mods';
import {setActivator} from './actions/settings';
import { IDeploymentManifest } from './types/IDeploymentManifest';
import {IDeployedFile, IDeploymentMethod} from './types/IDeploymentMethod';
import {IMod} from './types/IMod';
import {fallbackPurge, getManifest, loadActivation, purgeDeployedFiles, saveActivation} from './util/activationStore';
import { getCurrentActivator, getSupportedActivators } from './util/deploymentMethods';

import {getGame} from '../gamemode_management/util/getGame';
import { getModType } from '../gamemode_management/util/modTypeExtensions';
import {setModEnabled} from '../profile_management/actions/profiles';

import { setInstallPath } from './actions/settings';
import allTypesSupported from './util/allTypesSupported';
import { genSubDirFunc, loadAllManifests } from './util/deploy';
import queryGameId from './util/queryGameId';
import refreshMods from './util/refreshMods';

import InstallManager from './InstallManager';
import {currentActivator, installPath, installPathForGame} from './selectors';

import Promise from 'bluebird';
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
              + 'instance. If you\'re using Vortex in shared and "regular" mode, do not use '
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
    .catch(err => {
      if (err instanceof UserCanceled) {
        return Promise.reject(err);
      }
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

function queryStagingFolderInvalid(api: IExtensionApi,
                                   err: Error,
                                   dirExists: boolean,
                                   instPath: string)
                                   : Promise<IDialogResult> {
  if (dirExists) {
    // dir exists but not tagged
    return api.showDialog('error', 'Mod Staging Folder invalid', {
      bbcode: 'Your mod staging folder "{{path}}" is not marked correctly. This may be ok '
          + 'if you\'ve updated from a very old version of Vortex and you can ignore this.<br/>'
          + '[b]However[/b], if you use a removable medium (network or USB drive) and that path '
          + 'does not actually point to your real staging folder, you [b]have[/b] '
          + 'to make sure the actual folder is available and tell Vortex where it is.',
      message: err.message,
      parameters: {
        path: instPath,
      },
    }, [
      { label: 'Quit Vortex' },
      { label: 'Ignore' },
      { label: 'Browse...' },
    ]);
  }
  return api.showDialog('error', 'Mod Staging Folder missing!', {
      text: 'Your mod staging folder "{{path}}" is missing. This might happen because you '
        + 'deleted it or - if you have it on a removable drive - it is not currently '
        + 'connected.\nIf you continue now, a new staging folder will be created but all '
        + 'your previously managed mods will be lost.\n\n'
        + 'If you have moved the folder or the drive letter changed, you can browse '
        + 'for the new location manually, but please be extra careful to select the right '
        + 'folder!',
      message: instPath,
      parameters: {
        path: instPath,
      },
    }, [
      { label: 'Quit Vortex' },
      { label: 'Reinitialize' },
      { label: 'Browse...' },
    ]);
}

function ensureStagingDirectory(api: IExtensionApi,
                                instPath: string,
                                gameId: string)
                                : Promise<string> {

  let dirExists = false;
  return fs.statAsync(instPath)
    .then(() => {
      dirExists = true;
      // staging dir exists, does the tag exist?
      return fs.statAsync(path.join(instPath, STAGING_DIR_TAG));
    })
    .catch(err => {
      const state = api.store.getState();
      const mods = getSafe(state, ['persistent', 'mods', gameId], undefined);
      if ((dirExists === false) && (mods === undefined)) {
        // If the mods state branch for this game is undefined - this must be the
        //  first time we manage this game - just create the staging path.
        return fs.ensureDirWritableAsync(instPath, () => Promise.resolve());
      }
      return queryStagingFolderInvalid(api, err, dirExists, instPath)
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
              .catch(purgeErr => {
                if (purgeErr instanceof ProcessCanceled) {
                  log('warn', 'Mods not purged', purgeErr.message);
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
                return Promise.reject(new ProcessCanceled('not purged'));
              })
              .finally(() => {
                api.dismissNotification(id);
              });
          } else if (dialogResult.action === 'Ignore') {
            return Promise.resolve();
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
                    api.store.dispatch(setInstallPath(gameId, instPath));
                  });
              })
              .catch(() => ensureStagingDirectory(api, instPath, gameId));
          }
        });
      })
    .then(() => writeStagingTag(api, path.join(instPath, STAGING_DIR_TAG), gameId))
    .then(() => instPath);
}

// check staging folder against deployment manifest
function checkStagingFolder(api: IExtensionApi, gameId: string,
                            manifestPath: string, configuredPath: string)
                            : Promise<boolean> {
  const t = api.translate;

  // manifestPath can be undefined if the manifest is older
  return ((manifestPath !== undefined)
          ? getNormalizeFunc(manifestPath)
          : Promise.resolve(undefined))
    .then(normalize => {
      if ((manifestPath !== undefined)
          && (normalize(manifestPath) !== normalize(configuredPath))) {
        log('error', 'staging folder stored in manifest differs from configured one', {
          configured: configuredPath,
          manifest: manifestPath,
        });
        return api.showDialog('error', 'Staging folder changed', {
          bbcode: 'The staging folder configured in Vortex doesn\'t match what was '
            + 'previously used to deploy mods. This may be caused by manual tampering '
            + 'with the application state or some other kind of data corruption '
            + '(hardware failure, virus, ...).<br/><br/>'
            + '[color=red]If you continue with the wrong settings all installed mods '
            + 'may get corrupted![/color].<br/><br/>'
            + 'Please check the following two folders and pick the one that actually '
            + 'contains your mods.',
          choices: [
            {
              id: 'configured',
              text: t('From config: {{path}}', { replace: { path: configuredPath } }),
              value: true,
            },
            {
              id: 'manifest',
              text: t('From manifest: {{path}}', { replace: { path: manifestPath } }),
              value: false,
            },
          ],
        }, [
          { label: 'Quit Vortex' },
          { label: 'Use selected' },
        ])
          .then((result: IDialogResult) => {
            if (result.action === 'Quit Vortex') {
              app.exit();
              // resolve never
              return new Promise(() => null);
            } else if ((result.action === 'Use selected')
              && (result.input.manifest)) {
              return true;
            } else {
              return false;
            }
          });
      } else {
        return Promise.resolve(false);
      }
    });
}

export function onGameModeActivated(
    api: IExtensionApi, activators: IDeploymentMethod[], newGame: string) {
  // TODO: This function is a monster and needs to be refactored desperately, unfortunately
  //   it's also sensitive code
  const store = api.store;
  let state: IState = store.getState();
  let supported = getSupportedActivators(state);
  let activatorToUse = getCurrentActivator(state, newGame, true);
  const profile: IProfile = activeProfile(state);
  const gameId = profile.gameId;
  if (gameId !== newGame) {
    // this should never happen
    api.showErrorNotification('Event was triggered with incorrect parameter',
      new Error(`game id mismatch "${newGame}" vs "${gameId}"`));
  }
  const gameDiscovery = state.settings.gameMode.discovered[gameId];
  const game = getGame(gameId);

  if ((gameDiscovery?.path === undefined) || (game === undefined)) {
    // TODO: I don't think we should ever get here but if we do, is this a
    //   reasonable way of dealing with it? We're getting this callback because the profile
    //   has been changed, leaving the profile set without activating the game mode properly
    //   seems dangerous
    return;
  }

  setErrorContext('gamemode', game.name);

  let instPath = installPath(state);

  let changeActivator = false;

  let existingManifest: IDeploymentManifest;

  let initProm: () => Promise<void> = () => getManifest(api, '', gameId)
    .then((manifest: IDeploymentManifest) => {
      if (manifest.instance !== state.app.instanceId) {
        // if the manifest is from a different instance we do nothing with it, there
        // is other code to deal with that during deployment
        return Promise.resolve();
      }
      existingManifest = manifest;

      return checkStagingFolder(api, gameId, manifest.stagingPath, instPath)
        .then(useManifest => {
          if (useManifest) {
            log('info', 'reverting to staging path used in manifest');
            instPath = manifest.stagingPath;
            api.store.dispatch(setInstallPath(gameId, instPath));
            state = api.store.getState();
            if (manifest.deploymentMethod !== undefined) {
              log('info', 'also reverting the deployment method', {
                method: manifest.deploymentMethod });
              api.store.dispatch(setActivator(gameId, manifest.deploymentMethod));
              state = api.store.getState();
            }
            supported = getSupportedActivators(state);
            activatorToUse = getCurrentActivator(state, newGame, true);
            // cancel out of the activator reset because we have determined to use the
            // one from the manifest
            api.dismissNotification('deployment-method-unavailable');
            changeActivator = false;
          }
        });
    })
    .then(() => ensureStagingDirectory(api, instPath, gameId))
    .tap(updatedPath => instPath = updatedPath)
    .then(() => undefined);

  const configuredActivatorId = currentActivator(state);

  if (activatorToUse === undefined) {
    // current activator is not valid for this game. This should only occur
    // if compatibility of the activator has changed

    changeActivator = true;
    const oldActivator = activators.find(iter => iter.id === configuredActivatorId);
    const modPaths = game.getModPaths(gameDiscovery.path);

    // TODO: at this point we may also want to take into consideration the deployment
    //   method stored in the manifest, just in case that doesn't match the configured
    //   method for some reason
    if (configuredActivatorId !== undefined) {
      if (oldActivator === undefined) {
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
          }, { allowReport: false, id: 'deployment-method-unavailable' });
      } else {
        const modTypes = Object.keys(modPaths);

        const reason = allTypesSupported(oldActivator, state, gameId, modTypes);
        if (reason.errors.length === 0) {
          // wut? Guess the problem was temporary
          changeActivator = false;
        } else {
          api.showErrorNotification(
            'Deployment method no longer supported',
            {
              message:
                'The deployment method you had configured is no longer applicable.\n' +
                'Please resolve the problem described below or go to "Settings" and ' +
                'change the deployment method.',
              reason: reason.errors[0].description(api.translate),
            },
            { allowReport: false, id: 'deployment-method-unavailable' },
          );
        }
      }
    }

    log('info', 'change activator', { changeActivator, oldActivator: oldActivator?.id });

    if (changeActivator) {
      if (oldActivator !== undefined) {
        const stagingPath = installPath(state);
        const manifests: { [typeId: string]: IDeploymentManifest } = {};
        const deployments: { [typeId: string]: IDeployedFile[] } = {};
        const oldInit = initProm;
        initProm = () => oldInit()
          .then(() => Promise.all(Object.keys(modPaths).map((modType) =>
            getManifest(api, modType, gameId)
              .then(manifest => {
                manifests[modType] = manifest;
                deployments[modType] = manifest.files;
              })))
          .then(() => api.emitAndAwait('will-purge', profile.id, deployments))
          .then(() => oldActivator.prePurge(instPath))
          .then(() => Promise.mapSeries(Object.keys(modPaths), typeId => {
            return getNormalizeFunc(modPaths[typeId])
              .then(normalize => {
                // test for the special case where the game has been moved since the deployment
                // happened. Based on the assumption that this is the reason the deployment method
                // changed, the regular purge is almost guaranteed to not work correctly and we're
                // better off using the manifest-based fallback purge.
                // For example: if the game directory with hard links was moved, those links were
                // turned into real files, the regular purge op wouldn't clean up anything
                if ((manifests[typeId].targetPath !== undefined)
                    && (normalize(modPaths[typeId]) !== normalize(manifests[typeId].targetPath))
                    && oldActivator.isFallbackPurgeSafe) {
                  log('warn', 'using manifest-based purge because deployment path changed',
                      { from: manifests[typeId].targetPath, to: modPaths[typeId] });
                  return purgeDeployedFiles(modPaths[typeId], deployments[typeId]);
                } else {
                  return oldActivator.purge(instPath, modPaths[typeId], profile.gameId);
                }
              });
          }))
            .then(() => undefined)
            .catch(ProcessCanceled, () => Promise.resolve())
            .catch(TemporaryError, err =>
              api.showErrorNotification('Purge failed, please try again',
                err.message, { allowReport: false }))
            .catch(err => api.showErrorNotification('Purge failed', err, {
              allowReport: ['ENOENT', 'ENOTFOUND'].indexOf(err.code) !== -1,
            })))
          .catch(ProcessCanceled, () => Promise.resolve())
          .finally(() => oldActivator.postPurge())
          .then(() => api.emitAndAwait('did-purge', profile.id));
      }

      {
        const oldInit = initProm;
        initProm = () => oldInit()
          .then(() => {
            // by this point the flag may have been reset
            if (changeActivator) {
              if (supported.length > 0) {
                api.store.dispatch(setActivator(gameId, supported[0].id));
              }
            }
          });
      }
    }
  } else if (configuredActivatorId === undefined) {
    // no activator configured but we have found a valid one. Store this.
    api.store.dispatch(setActivator(gameId, activatorToUse.id));
    api.sendNotification({
      type: 'info',
      title: 'Using default deployment method',
      message: activatorToUse.name,
      displayMS: 5000,
    });
  }

  const knownMods: { [modId: string]: IMod } = getSafe(state, ['persistent', 'mods', gameId], {});
  initProm()
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

  const empty = (input) => !input || (Array.isArray(input) && input.length === 0);
  const different = (lhs, rhs) => (!empty(lhs) || !empty(rhs)) && lhs !== rhs;
  const changed = (modId: string, attribute: string) =>
    different(previous[gameMode][modId][attribute], current[gameMode][modId][attribute]);

  const rulesOrOverridesChanged = modId =>
    (getSafe(previous, [gameMode, modId], undefined) !== undefined)
    && (changed(modId, 'rules') || changed(modId, 'fileOverrides'));

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

  log('debug', 'undeploying single mod', { game: gameMode, modId: mod.id });

  const activatorId: string =
    getSafe(state, ['settings', 'mods', 'activator', gameMode], undefined);
  // TODO: can only use one activator that needs to support the whole game
  const activator: IDeploymentMethod = activatorId !== undefined
    ? activators.find(act => act.id === activatorId)
    : activators.find(act => allTypesSupported(act, state, gameMode, modTypes).errors.length === 0);

  if (activator === undefined) {
    return Promise.reject(new ProcessCanceled('No deployment method active'));
  }

  const stagingPath = installPathForGame(state, gameMode);

  const subdir = genSubDirFunc(game, getModType(mod.type));
  const deployPath = modPaths[mod.type || ''];
  if (deployPath === undefined) {
    return Promise.resolve();
  }
  let normalize: Normalize;
  return getNormalizeFunc(deployPath)
    .then(norm => {
      normalize = norm;
      return loadActivation(api, mod.type, deployPath, stagingPath, activator);
    })
    .then(lastActivation => activator.prepare(deployPath, false, lastActivation, normalize))
    .then(() => (mod !== undefined)
      ? activator.deactivate(path.join(stagingPath, mod.installationPath),
                             subdir(mod), mod.installationPath)
      : Promise.resolve())
    .tapCatch(() => {
      if (activator.cancel !== undefined) {
        activator.cancel(gameMode, deployPath, stagingPath);
      }
    })
    .then(() => activator.finalize(gameMode, deployPath, stagingPath))
    .then(newActivation =>
      saveActivation(mod.type, state.app.instanceId, deployPath,
                     stagingPath, newActivation, activator.id))
    .finally(() => {
      log('debug', 'done undeploying single mod', { game: gameMode, modId: mod.id });
    });
}

export function onRemoveMod(api: IExtensionApi,
                            activators: IDeploymentMethod[],
                            gameMode: string,
                            modId: string,
                            callback?: (error: Error) => void) {
  const store = api.store;
  const state: IState = store.getState();

  log('debug', 'removing mod', { game: gameMode, mod: modId });

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
      api.showErrorNotification('Failed to remove mod (not found)', err);
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
    if (mod.installationPath === undefined) {
      // don't try to undeploy a mod that has no installation path (it can't be deployed
      // anyway)
      return Promise.resolve();
    }
    return undeploy(api, activators, gameMode, mod)
      .catch({ code: 'ENOTFOUND' }, () => {
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
              return new Promise<void>((resolve, reject) => {
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

  store.dispatch(startActivity('mods', `removing_${modId}`));

  undeployMod()
  .then(() => {
    if (truthy(mod) && truthy(mod.installationPath)) {
      const fullModPath = path.join(installationPath, mod.installationPath);
      log('debug', 'removing files for mod', { game: gameMode, mod: modId });
      return fs.removeAsync(fullModPath)
        .catch({ code: 'ENOTEMPTY' }, () => fs.removeAsync(fullModPath))
        .catch(err => err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err));
    } else {
      return Promise.resolve();
    }
  })
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
      api.showErrorNotification('Failed to remove mod', err, { allowReport: false });
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
  })
  .finally(() => {
    log('debug', 'done removing mod', { game: gameMode, mod: modId });
    store.dispatch(stopActivity('mods', `removing_${modId}`));
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
                                       allowAutoEnable?: boolean,
                                       forceInstaller?: string,
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

  return queryGameId(api.store, download.game, download.localPath)
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
      const { enable } = state.settings.automation;
      installManager.install(downloadId, fullPath, download.game, api,
        { download }, true, enable && (allowAutoEnable !== false), callback, gameId,
        forceInstaller);
    })
    .catch(err => {
      if (callback !== undefined) {
        callback(err, undefined);
      } else if (!(err instanceof UserCanceled)) {
        api.showErrorNotification('Failed to start download', err);
      }
    });
}
