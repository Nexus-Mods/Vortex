import { startActivity, stopActivity } from '../../actions/session';
import { IDialogResult } from '../../types/IDialog';
import {IExtensionApi} from '../../types/IExtensionContext';
import {IModTable, IProfile, IState} from '../../types/IState';
import { getApplication } from '../../util/application';
import { DataInvalid, ProcessCanceled,
         TemporaryError, UserCanceled } from '../../util/CustomErrors';
import { setErrorContext } from '../../util/errorHandling';
import * as fs from '../../util/fs';
import getNormalizeFunc, { Normalize } from '../../util/getNormalizeFunc';
import { log } from '../../util/log';
import {showError} from '../../util/message';
import { downloadPathForGame } from '../../util/selectors';
import {getSafe} from '../../util/storeHelper';
import {batchDispatch, truthy} from '../../util/util';

import {IDownload} from '../download_management/types/IDownload';
import {activeGameId, activeProfile} from '../profile_management/selectors';

import { setDeploymentNecessary } from './actions/deployment';
import {addMod, removeMod} from './actions/mods';
import {setActivator} from './actions/settings';
import { IDeploymentManifest } from './types/IDeploymentManifest';
import {IDeployedFile, IDeploymentMethod} from './types/IDeploymentMethod';
import {IMod, IModRule} from './types/IMod';
import {getManifest, loadActivation, purgeDeployedFiles, saveActivation, withActivationLock} from './util/activationStore';
import { getCurrentActivator, getSelectedActivator, getSupportedActivators } from './util/deploymentMethods';

import getDownloadGames from '../download_management/util/getDownloadGames';
import {getGame} from '../gamemode_management/util/getGame';
import { getModType } from '../gamemode_management/util/modTypeExtensions';
import {setModsEnabled} from '../profile_management/actions/profiles';

import { setInstallPath } from './actions/settings';
import { IInstallOptions } from './types/IInstallOptions';
import { IRemoveModOptions } from './types/IRemoveModOptions';
import allTypesSupported from './util/allTypesSupported';
import { genSubDirFunc, purgeMods } from './util/deploy';
import modName from './util/modName';
import queryGameId from './util/queryGameId';
import refreshMods from './util/refreshMods';

import InstallManager from './InstallManager';
import {currentActivator, installPath, installPathForGame} from './selectors';
import { ensureStagingDirectory } from './stagingDirectory';

import Promise from 'bluebird';
import * as _ from 'lodash';
import { RuleType } from 'modmeta-db';
import * as path from 'path';

function checkStagingGame(api: IExtensionApi, gameId: string, manifestGameId: string)
  : Promise<boolean> {
  if ((manifestGameId !== undefined) && (gameId !== manifestGameId)) {
    return api.showDialog('error', 'Game managed by different game extension', {
      text: 'You seem to have multiple games inside Vortex trying to manage the same game '
          + 'directory. This can happen in case of total conversions or if you use a '
          + 'third-party extension for a game that has also bundled support in Vortex.\n'
          + 'If you continue now, Vortex will purge the deployment from the other extension. '
          + 'This is not destructive, you can go back to the other extension any time.',
    }, [
      { label: 'Cancel' },
      { label: 'Purge' },
    ])
    .then(result => {
      if (result.action === 'Cancel') {
        return Promise.reject(new UserCanceled());
      } else {
        return purgeMods(api, manifestGameId)
          .then(() => true);
      }
    });
  } else {
    return Promise.resolve(false);
  }
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
              getApplication().quit();
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

function purgeOldMethod(api: IExtensionApi,
                        oldActivator: IDeploymentMethod,
                        profile: IProfile,
                        gameId: string,
                        instPath: string,
                        modPaths: { [typeId: string]: string }) {
  const state = api.getState();
  const stagingPath = installPath(state);
  const manifests: { [typeId: string]: IDeploymentManifest } = {};
  const deployments: { [typeId: string]: IDeployedFile[] } = {};

  return Promise.all(Object.keys(modPaths).map((modType) =>
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
        })
        ;
    }))
    // save (empty) activation
    .then(() => Promise.map(Object.keys(modPaths), typeId =>
      saveActivation(gameId, typeId, state.app.instanceId, modPaths[typeId],
        stagingPath, [], oldActivator.id)))
    .then(() => undefined)
    .finally(() => oldActivator.postPurge())
    .catch(ProcessCanceled, () => Promise.resolve())
    .catch(TemporaryError, err =>
      api.showErrorNotification('Purge failed, please try again',
        err.message, { allowReport: false }))
    .catch(err => api.showErrorNotification('Purge failed', err, {
      allowReport: ['ENOENT', 'ENOTFOUND'].indexOf(err.code) !== -1,
    }));
}

export async function updateDeploymentMethod(api: IExtensionApi, profile: IProfile) {
  const store = api.store;
  const state: IState = store.getState();
  const gameId = profile.gameId;

  const selected: IDeploymentMethod = getSelectedActivator(state, gameId);
  if (selected !== undefined) {
    // do nothing if there already is a selected activator
    return Promise.resolve();
  }

  const valid = getCurrentActivator(state, gameId, true);
  if (valid !== undefined) {
    store.dispatch(setActivator(gameId, valid.id));
    api.sendNotification({
      type: 'info',
      title: 'Using default deployment method',
      message: valid.name,
      displayMS: 5000,
    });
  }
}

export function onGameModeActivated(
    api: IExtensionApi, activators: IDeploymentMethod[], newGame: string) {
  // TODO: This function is a monster and needs to be refactored desperately, unfortunately
  //   it's also sensitive code
  const store = api.store;
  let state: IState = store.getState();
  let supported: IDeploymentMethod[] = getSupportedActivators(state);
  // this is either the configured activator or the default one if none is configured.
  // might be undefined if the game isn't properly discovered or the configured activator
  // is no longer supported
  let activatorToUse: IDeploymentMethod = getCurrentActivator(state, newGame, true);
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
  if (truthy(game?.version)) {
    setErrorContext('extension_version', game.version);
  }

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

      return checkStagingGame(api, gameId, manifest.gameId)
        .then((purged: boolean) => purged
          ? Promise.resolve(false)
          : checkStagingFolder(api, gameId, manifest.stagingPath, instPath))
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

    const safeFB = (oldActivator !== undefined)
      ? supported.find(method => (method.compatible ?? []).includes(oldActivator.id))
      : undefined;

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
          if (safeFB !== undefined) {
            api.sendNotification({
              type: 'info',
              title: 'Deployment method changed',
              message: safeFB.name,
            });
          } else {
            api.showErrorNotification(
              'Deployment method no longer supported',
              {
                message:
                  'The deployment method you had configured ({{method}}) is no longer ' +
                  'applicable.\n' +
                  'Please resolve the problem described below or go to "Settings" and ' +
                  'change the deployment method.',
                reason: reason.errors[0].description(api.translate),
              },
              {
                allowReport: false,
                id: 'deployment-method-unavailable',
                replace: {
                  method: oldActivator.name,
                },
              },
            );
          }
        }
      }
    }

    log('info', 'change activator', { changeActivator, oldActivator: oldActivator?.id });

    if (changeActivator) {
      if (oldActivator !== undefined) {
        const oldInit = initProm;
        initProm = () => oldInit()
          .then(() => (safeFB === undefined)
            ? purgeOldMethod(api, oldActivator, profile, gameId, instPath, modPaths)
            : Promise.resolve())
          .catch(ProcessCanceled, () => Promise.resolve());
      }

      {
        const oldInit = initProm;
        initProm = () => oldInit()
          .then(() => {
            // by this point the flag may have been reset
            if (changeActivator) {
              if (supported.length > 0) {
                api.store.dispatch(setActivator(gameId, (safeFB ?? supported[0]).id));
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
    .then(() => refreshMods(api, gameId, instPath, knownMods, (mod: IMod) => {
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
      const error: any = (err as any);
      const allowReport = (error.allowReport !== undefined)
        ? error.allowReport
        : !['ENOENT'].includes(error.code);
      showError(store.dispatch, 'Failed to refresh mods', err, { allowReport });
    });
}

export function onPathsChanged(api: IExtensionApi,
                               previous: { [gameId: string]: string },
                               current: { [gameId: string]: string }) {
  const { store } = api;
  const state = store.getState();
  const profile = activeProfile(state);
  const gameMode = profile?.gameId;
  if ((gameMode !== undefined) && (previous[gameMode] !== current[gameMode])) {
    const knownMods = state.persistent.mods[gameMode];
    refreshMods(api, gameMode, installPath(state), knownMods || {}, (mod: IMod) =>
      store.dispatch(addMod(gameMode, mod))
      , (modNames: string[]) => {
        modNames.forEach((name: string) => {
          if (['downloaded', 'installed'].indexOf(knownMods[name].state) !== -1) {
            store.dispatch(removeMod(gameMode, name));
          }
        });
      })
      .then(() => updateDeploymentMethod(api, profile))
      .catch((err: Error) => {
        showError(store.dispatch, 'Failed to refresh mods', err, {
          allowReport: !(err instanceof UserCanceled),
        });
      });
  }
}

function loadOrderRulesChanged(before: IModRule[], after: IModRule[]): boolean {
  if (before === after) {
    return false;
  }

  // if the rules changed it's still possible the change was only in rules unrelated to
  // load order

  const types: RuleType[] = ['before', 'after'];

  const normalizeRules = (input: IModRule[]) => (input ?? [])
    .filter(rule => types.includes(rule.type))
    .map(rule => _.omit(rule, ['idHint', 'md5Hint']))
    .sort;

  return !_.isEqual(normalizeRules(before), normalizeRules(after));
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
    && (loadOrderRulesChanged(previous[gameMode][modId].rules, current[gameMode][modId].rules)
        || changed(modId, 'fileOverrides') || changed(modId, 'type'));

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
                  mods: IMod[]): Promise<void> {
  const store = api.store;
  const state: IState = store.getState();

  const discovery = state.settings.gameMode.discovered[gameMode];

  if ((discovery === undefined) || (discovery.path === undefined)) {
    // if the game hasn't been discovered we can't deploy, but that's not really a problem
    return Promise.resolve();
  }

  const game = getGame(gameMode);

  if (game === undefined) {
    log('info', 'tried to undeploy for unknown game', gameMode);
    return Promise.resolve();
  }

  const modPaths = game.getModPaths(discovery.path);
  const modTypes = Object.keys(modPaths);

  log('debug', 'undeploying single mod',
    { game: gameMode, modIds: mods.map(mod => mod.id).join(', ') });

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

  const byModTypes: { [typeId: string]: IMod[] } = mods.reduce((prev, mod: IMod) => {
    if (prev[mod.type] === undefined) {
      prev[mod.type] = [];
    }
    prev[mod.type].push(mod);
    return prev;
  }, {});

  return Promise.all(Object.keys(byModTypes).map(typeId => {
    const subdir = genSubDirFunc(game, getModType(typeId));
    const deployPath = modPaths[typeId || ''];
    if (deployPath === undefined) {
      return Promise.resolve();
    }
    let normalize: Normalize;
    return getNormalizeFunc(deployPath)
      .then(norm => {
        normalize = norm;
        return loadActivation(api, gameMode, typeId, deployPath, stagingPath, activator);
      })
      .then(lastActivation => activator.prepare(deployPath, false, lastActivation, normalize))
      .then(() => Promise.all(byModTypes[typeId].map(mod =>
        activator.deactivate(path.join(stagingPath, mod.installationPath),
                             subdir(mod), mod.installationPath))))
      .tapCatch(() => {
        if (activator.cancel !== undefined) {
          activator.cancel(gameMode, deployPath, stagingPath);
        }
      })
      .then(() => activator.finalize(gameMode, deployPath, stagingPath))
      .then(newActivation =>
        saveActivation(gameMode, typeId, state.app.instanceId, deployPath,
                       stagingPath, newActivation, activator.id));
  }))
  .finally(() => {
    log('debug', 'done undeploying single mod',
      { game: gameMode, modIds: mods.map(mod => mod.id).join(', ') });
  })
  .then(() => Promise.resolve());
}

function undeployMods(api: IExtensionApi,
                      activators: IDeploymentMethod[],
                      gameId: string,
                      mods: IMod[]) {
  // don't try to undeploy a mod that has no installation path (it can't be deployed
  // anyway)
  mods = mods.filter(mod => mod.installationPath !== undefined);

  return undeploy(api, activators, gameId, mods)
    .catch((err) => {
      if (!['ENOENT', 'ENOTFOUND'].includes(err.code)) {
        return Promise.reject(err);
      }
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
}

export function onRemoveMods(api: IExtensionApi,
                             activators: IDeploymentMethod[],
                             gameId: string,
                             modIds: string[],
                             callback?: (error: Error) => void,
                             options?: IRemoveModOptions) {
  const store = api.store;
  const state: IState = store.getState();

  if (gameId === undefined) {
    return callback(new ProcessCanceled('No game id assigned to remove mods from'));
  }

  modIds = modIds.filter(modId => truthy(modId));

  log('debug', 'removing mods', { game: gameId, mods: modIds });

  // reject trying to remove mods that are actively being installed/downloaded
  const notInstalled = modIds.find(modId => {
    const modState = getSafe(state, ['persistent', 'mods', gameId, modId, 'state'], undefined);
    return (modState !== undefined)
        && !['downloaded', 'installed'].includes(modState);
  });

  if ((options?.ignoreInstalling !== true) && (notInstalled !== undefined)) {
    if (callback !== undefined) {
      callback(new ProcessCanceled('Can\'t delete mod during download or install'));
    }
    return;
  }

  const profileId = state.settings.profiles.lastActiveProfile[gameId];

  // is it even a plausible scenario that there is no profile active?
  if (profileId !== undefined) {
    // Disable automatic deployment if it's active, a deployment
    //  event will occur once the mods have been successfully removed
    //  anyway.
    setModsEnabled(api, profileId, modIds, false, {
      installed: options?.incomplete,
      allowAutoDeploy: false,
      willBeReplaced: options?.willBeReplaced,
    });
  }

  // undeploy mods, otherwise we'd leave orphaned links in the game directory
  const installationPath = installPathForGame(state, gameId);

  const mods = state.persistent.mods[gameId];
  const removeMods: IMod[] = modIds
    .map(modId => mods[modId])
    .filter(mod => mod !== undefined);

  // TODO: no indication anything is happening until undeployment was successful.
  //   we used to remove the mod right away but then if undeployment failed the mod was gone
  //   anyway

  store.dispatch(startActivity('mods', `removing_${modIds[0]}`));

  api.emitAndAwait('will-remove-mods', gameId, removeMods.map(mod => mod.id), options)
    .then(() => undeployMods(api, activators, gameId, removeMods))
    .then(() => Promise.mapSeries(removeMods,
        (mod: IMod, idx: number, length: number) => {
      options?.progressCB?.(idx, length, modName(mod));
      const forwardOptions = { ...(options || {}), modData: { ...mod } };
      return api.emitAndAwait('will-remove-mod', gameId, mod.id, forwardOptions)
      .then(() => {
        if (truthy(mod) && truthy(mod.installationPath)) {
          const fullModPath = path.join(installationPath, mod.installationPath);
          log('debug', 'removing files for mod',
              { game: gameId, mod: mod.id });
          return fs.removeAsync(fullModPath)
            .catch({ code: 'ENOTEMPTY' }, () => fs.removeAsync(fullModPath))
            .catch(err => err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err));
        } else {
          return Promise.resolve();
        }
      })
      .then(() => {
        store.dispatch(removeMod(gameId, mod.id));
        return api.emitAndAwait('did-remove-mod', gameId, mod.id, forwardOptions);
      });
    }))
    .then(() => {
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
      log('debug', 'done removing mods', { game: gameId, mods: modIds });
      store.dispatch(stopActivity('mods', `removing_${modIds[0]}`));
      return api.emitAndAwait('did-remove-mods', gameId, removeMods);
    });
}

export function onRemoveMod(api: IExtensionApi,
                            activators: IDeploymentMethod[],
                            gameId: string,
                            modId: string,
                            callback?: (error: Error) => void,
                            options?: IRemoveModOptions) {
  if (!truthy(modId)) {
    callback?.(null);
    return;
  }
  return onRemoveMods(api, activators, gameId, [modId], callback, options);
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
                                       options: IInstallOptions,
                                       callback?: (error, id: string) => void): Promise<void> {
  const store = api.store;
  const state: IState = store.getState();
  const download: IDownload = state.persistent.downloads.files[downloadId];
  if (download === undefined) {
    if (callback !== undefined) {
      callback(new DataInvalid('Unknown Download'), undefined);
    } else {
      api.showErrorNotification('Unknown Download',
        'Vortex attempted to install a mod archive which is no longer available '
        + 'in its internal state - this usually happens if the archive was scheduled '
        + 'to be installed but was removed before the installation was able to start. '
        + 'Given that the archive is gone, information such as file name, mod name, etc is not '
        + 'available either - sorry.',
      { allowReport: false });
    }
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

      const downloadGame: string[] = getDownloadGames(download);
      const downloadPath: string = downloadPathForGame(state, downloadGame[0]);
      if (downloadPath === undefined) {
        api.showErrorNotification('Unknown Game',
          'Failed to determine download directory. This shouldn\'t have happened', {
            message: downloadGame[0],
            allowReport: true,
          });
        return;
      }
      const fullPath: string = path.join(downloadPath, download.localPath);
      const allowAutoDeploy = options.allowAutoEnable !== false;
      const { enable } = state.settings.automation;
      installManager.install(downloadId, fullPath, downloadGame, api,
        { download, choices: options.choices }, true, enable && allowAutoDeploy,
        callback, gameId, options.fileList, options.unattended, options.forceInstaller, allowAutoDeploy);
    })
    .catch(err => {
      if (callback !== undefined) {
        callback(err, undefined);
      } else if (!(err instanceof UserCanceled)) {
        api.showErrorNotification('Failed to start download', err);
      }
    });
}
