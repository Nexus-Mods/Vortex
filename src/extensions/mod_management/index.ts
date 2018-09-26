import { updateNotification, dismissNotification } from '../../actions/notifications';
import { setSettingsPage } from '../../actions/session';
import {
  IExtensionApi,
  IExtensionContext,
  MergeFunc,
  MergeTest,
} from '../../types/IExtensionContext';
import {IGame} from '../../types/IGame';
import {IState} from '../../types/IState';
import { ITableAttribute } from '../../types/ITableAttribute';
import {ITestResult} from '../../types/ITestResult';
import { ProcessCanceled, TemporaryError, UserCanceled } from '../../util/CustomErrors';
import Debouncer from '../../util/Debouncer';
import * as fs from '../../util/fs';
import getNormalizeFunc, { Normalize } from '../../util/getNormalizeFunc';
import LazyComponent from '../../util/LazyComponent';
import { log } from '../../util/log';
import ReduxProp from '../../util/ReduxProp';
import {
  activeGameId,
  activeProfile,
  currentGameDiscovery,
  installPath,
  installPathForGame,
} from '../../util/selectors';
import {getSafe} from '../../util/storeHelper';
import { removePersistent, setdefault, truthy } from '../../util/util';

import {setDownloadModInfo} from '../download_management/actions/state';
import {getGame} from '../gamemode_management/index';
import {IProfileMod, IProfile} from '../profile_management/types/IProfile';

import {showExternalChanges} from './actions/externalChanges';
import {removeMod, setModAttribute} from './actions/mods';
import {externalChangesReducer} from './reducers/externalChanges';
import {modsReducer} from './reducers/mods';
import {settingsReducer} from './reducers/settings';
import {IDeployedFile, IDeploymentMethod, IFileChange} from './types/IDeploymentMethod';
import {IFileEntry} from './types/IFileEntry';
import {IFileMerge} from './types/IFileMerge';
import {IMod} from './types/IMod';
import {IModSource} from './types/IModSource';
import {InstallFunc} from './types/InstallFunc';
import {IResolvedMerger} from './types/IResolvedMerger';
import {TestSupported} from './types/TestSupported';
import { loadActivation, saveActivation } from './util/activationStore';
import allTypesSupported from './util/allTypesSupported';
import * as basicInstaller from './util/basicInstaller';
import { NoDeployment } from './util/exceptions';
import { registerAttributeExtractor } from './util/filterModInfo';
import sortMods from './util/sort';
import supportedActivators from './util/supportedActivators';
import ActivationButton from './views/ActivationButton';
import DeactivationButton from './views/DeactivationButton';
import {} from './views/ExternalChangeDialog';
import {} from './views/ModList';
import {} from './views/Settings';

import { onAddMod, onGameModeActivated, onPathsChanged,
         onRemoveMod, onStartInstallDownload } from './eventHandlers';
import InstallManager from './InstallManager';
import deployMods from './modActivation';
import mergeMods, { MERGED_PATH } from './modMerging';
import getText from './texts';

import * as Promise from 'bluebird';
import { genHash } from 'modmeta-db';
import * as path from 'path';
import * as Redux from 'redux';

const activators: IDeploymentMethod[] = [];

let installManager: InstallManager;

interface IInstaller {
  id: string;
  priority: number;
  testSupported: TestSupported;
  install: InstallFunc;
}

const installers: IInstaller[] = [];

const modSources: IModSource[] = [];

const mergers: IFileMerge[] = [];

function registerDeploymentMethod(activator: IDeploymentMethod) {
  activators.push(activator);
}

function registerInstaller(id: string, priority: number,
                           testSupported: TestSupported, install: InstallFunc) {
  installers.push({ id, priority, testSupported, install });
}

function registerModSource(id: string, name: string, onBrowse: () => void) {
  modSources.push({ id, name, onBrowse });
}

function registerMerge(test: MergeTest, merge: MergeFunc, modType: string) {
  mergers.push({ test, merge, modType });
}

function getActivator(state: IState, gameMode?: string): IDeploymentMethod {
  const gameId = gameMode || activeGameId(state);
  const activatorId = state.settings.mods.activator[gameId];

  let activator: IDeploymentMethod;
  if (activatorId !== undefined) {
    activator = activators.find((act: IDeploymentMethod) => act.id === activatorId);
  }

  const gameDiscovery =
    getSafe(state, ['settings', 'gameMode', 'discovered', gameId], undefined);
  const types = Object.keys(getGame(gameId).getModPaths(gameDiscovery.path));

  if (allTypesSupported(activator, state, gameId, types) !== undefined) {
    // if the selected activator is no longer supported, don't use it
    activator = undefined;
  }

  if (activator === undefined) {
    activator = activators.find(act =>
      allTypesSupported(act, state, gameId, types) === undefined);
  }

  return activator;
}

function purgeMods(api: IExtensionApi): Promise<void> {
  const state = api.store.getState();
  const instPath = installPath(state);
  const gameId = activeGameId(state);
  const gameDiscovery = currentGameDiscovery(state);
  const t = api.translate;
  const activator = getActivator(state);

  if (activator === undefined) {
    return Promise.reject(new NoDeployment());
  }

  const notificationId = api.sendNotification({
    type: 'activity',
    message: t('Purging mods'),
    title: t('Purging'),
  });

  const game: IGame = getGame(gameId);
  const modPaths = game.getModPaths(gameDiscovery.path);

  return Promise.each(Object.keys(modPaths), typeId =>
    loadActivation(api, typeId, modPaths[typeId])
      .then(() => activator.purge(instPath, modPaths[typeId]))
      .then(() => saveActivation(typeId, state.app.instanceId, modPaths[typeId], [])))
  .catch(UserCanceled, () => undefined)
  .catch(TemporaryError, err =>
    api.showErrorNotification('Failed to purge mods, please try again',
                              err, { allowReport: false }))
  .catch(err => api.showErrorNotification('Failed to purge mods', err))
  .finally(() => api.dismissNotification(notificationId));
}

/**
 * look at the file actions and act accordingly. Depending on the action this can
 * be a direct file operation or a modification to the previous manifest so that
 * the deployment ext runs the necessary operation
 * @param {string} sourcePath the "virtual" mod directory
 * @param {string} outputPath the destination directory where the game expects mods
 * @param {IDeployedFile[]} lastDeployment previous deployment to use as reference
 * @param {IFileEntry[]} fileActions actions the user selected for external changes
 * @returns {Promise<IDeployedFile[]>} an updated deployment manifest to use as a reference
 *                                     for the new one
 */
function applyFileActions(sourcePath: string,
                          outputPath: string,
                          lastDeployment: IDeployedFile[],
                          fileActions: IFileEntry[]): Promise<IDeployedFile[]> {
  if (fileActions === undefined) {
    return Promise.resolve(lastDeployment);
  }

  const actionGroups: { [type: string]: IFileEntry[] } = fileActions.reduce((prev, value) => {
      setdefault(prev, value.action, []).push(value);
      return prev;
    }, {});

  // not doing anything with 'nop'. The regular deployment code is responsible for doing the right
  // thing in this case.

  // process the actions that the user selected in the dialog
  return Promise.map(actionGroups['drop'] || [],
      // delete the links the user wants to drop.
      (entry) => truthy(entry.filePath)
          ? fs.removeAsync(path.join(outputPath, entry.filePath))
          : Promise.reject(new Error('invalid file path')))
    .then(() => Promise.map(actionGroups['delete'] || [],
      entry => truthy(entry.filePath)
          ? fs.removeAsync(path.join(sourcePath, entry.source, entry.filePath))
          : Promise.reject(new Error('invalid file path'))))
    .then(() => Promise.map(actionGroups['import'] || [],
      // copy the files the user wants to import
      (entry) => {
        const source = path.join(sourcePath, entry.source, entry.filePath);
        const deployed = path.join(outputPath, entry.filePath);
        // Very rarely we have a case where the files are links of each other
        // (or at least node reports that) so the copy would fail.
        // Instead of handling the errors (when we can't be sure if it's due to a bug in node.js
        // or the files are actually identical), delete the target first, that way the copy
        // can't fail
        return fs.removeAsync(source)
          .then(() => fs.copyAsync(deployed, source));
      }))
    .then(() => {
      // remove files that the user wants to restore from
      // the activation list because then they get reinstalled.
      // this includes files that were deleted and those replaced
      const dropSet = new Set([].concat(
        (actionGroups['restore'] || []).map(entry => entry.filePath),
        (actionGroups['drop'] || []).map(entry => entry.filePath),
        // also remove the files that got deleted, except these won't be reinstalled
        (actionGroups['delete'] || []).map(entry => entry.filePath),
      ));
      const newDeployment = lastDeployment.filter(entry => !dropSet.has(entry.relPath));
      lastDeployment = newDeployment;
      return Promise.resolve();
    })
    .then(() => lastDeployment);
}

function bakeSettings(api: IExtensionApi, gameMode: string, sortedModList: IMod[]) {
  return new Promise((resolve, reject) => {
    api.events.emit('bake-settings', gameMode, sortedModList,
      err => {
        if (err !== null) {
          reject(err);
        } else {
          resolve();
        }
      });
  });
}

function genSubDirFunc(game: IGame): (mod: IMod) => string {
  if (typeof(game.mergeMods) === 'boolean') {
    return game.mergeMods
      ? () => ''
      : (mod: IMod) => mod.id;
  } else {
    return game.mergeMods;
  }
}

function genUpdateModDeployment() {
  return (api: IExtensionApi, manual: boolean, profileId?: string,
          progressCB?: (text: string, percent: number) => void): Promise<void> => {
    let notificationId: string;

    const progress = (text: string, percent: number) => {
      if (progressCB !== undefined) {
        progressCB(text, percent);
      }
      api.store.dispatch(updateNotification(notificationId, percent, text));
    };
    let state = api.store.getState();
    let profile: IProfile = profileId !== undefined
      ? getSafe(state, ['persistent', 'profiles', profileId], undefined)
      : activeProfile(state);
    if (profile === undefined) {
      // Used to report an exception here but I don't think this is an error, the call
      // can be delayed so it's completely possible there is no profile active at the the time
      // or has been deleted by then. Rare but not a bug
      api.store.dispatch(dismissNotification(notificationId));
      return Promise.resolve();
    }
    const instPath = installPathForGame(state, profile.gameId);
    const gameDiscovery =
      getSafe(state, ['settings', 'gameMode', 'discovered', profile.gameId], undefined);
    const game = getGame(profile.gameId);
    if (game === undefined) {
      return Promise.reject(new Error('Game no longer available'));
    }
    const modPaths = game.getModPaths(gameDiscovery.path);
    const t = api.translate;
    const activator = getActivator(state, profile.gameId);

    if (activator === undefined) {
      // this situation (no supported activator) should already be reported
      // elsewhere.
      return Promise.resolve();
    }

    const mods = state.persistent.mods[profile.gameId] || {};
    const gate = manual ? Promise.resolve() : activator.userGate();

    const lastDeployment: { [typeId: string]: IDeployedFile[] } = {};
    const newDeployment: { [typeId: string]: IDeployedFile[] } = {};

    const fileMergers = mergers.reduce((prev: IResolvedMerger[], merge) => {
      const match = merge.test(game, gameDiscovery);
      if (match !== undefined) {
        prev.push({match, merge: merge.merge, modType: merge.modType});
      }
      return prev;
    }, []);

    // test if anything was changed by an external application
    return gate
      .then(() => {

        notificationId = api.sendNotification({
          type: 'activity',
          message: t('Deploying mods'),
          title: t('Deploying'),
        });

        log('debug', 'load activation');
        return Promise.each(Object.keys(modPaths),
          typeId => loadActivation(api, typeId, modPaths[typeId]).then(
            deployedFiles => lastDeployment[typeId] = deployedFiles));
      })
      .then(() => api.emitAndAwait('will-deploy', profile.id, lastDeployment))
      .then(() => {
        // for each mod type, check if the local files were changed outside vortex
        const changes: { [typeId: string]: IFileChange[] } = {};
        log('debug', 'determine external changes');
        // update mod state again because if the user did have to confirm,
        // it's more intuitive if we deploy the state at the time he confirmed, not when
        // the deployment was triggered
        state = api.store.getState();
        profile = profileId !== undefined
          ? getSafe(state, ['persistent', 'profiles', profileId], undefined)
          : activeProfile(state);
        progress(t('Checking for external changes'), 5);
        return Promise.each(Object.keys(modPaths),
          typeId => activator.externalChanges(profile.gameId, instPath, modPaths[typeId],
            lastDeployment[typeId]).then(fileChanges => {
              if (fileChanges.length > 0) {
                changes[typeId] = fileChanges;
              }
            }))
          .then(() => changes);
      })
      .then((changes: { [typeId: string]: IFileChange[] }) => {
        log('debug', 'done checking for external changes');
        progress(t('Sorting mods'), 30);
        return (Object.keys(changes).length === 0) ?
                   Promise.resolve([]) :
                   api.store.dispatch(showExternalChanges(changes));
      })
      .then((fileActions: IFileEntry[]) => Promise.mapSeries(Object.keys(lastDeployment),
        typeId => applyFileActions(instPath, modPaths[typeId],
                                   lastDeployment[typeId],
                                   fileActions.filter(action => action.modTypeId === typeId))
                .then(newLastDeployment => lastDeployment[typeId] = newLastDeployment)))
      // sort (all) mods based on their dependencies so the right files get activated
      .then(() => {
        const modState: { [id: string]: IProfileMod } = profile !== undefined ? profile.modState : {};
        const unsorted = Object.keys(mods)
            .map((key: string) => mods[key])
            .filter((mod: IMod) => getSafe(modState, [mod.id, 'enabled'], false));

        return sortMods(profile.gameId, unsorted, api);
      })
      .then((sortedModList: IMod[]) => {
        const mergedFileMap: { [modType: string]: string[] } = {};

        progress(t('Merging mods'), 35);
        // merge mods
        return Promise.mapSeries(Object.keys(modPaths),
            typeId => {
              const mergePath = truthy(typeId)
                ? MERGED_PATH + '.' + typeId
                : MERGED_PATH;

              return removePersistent(api.store, path.join(instPath, mergePath));
            })
          .then(() => Promise.each(Object.keys(modPaths),
            typeId => mergeMods(api, game, instPath, modPaths[typeId],
                                sortedModList.filter(mod => (mod.type || '') === typeId),
                                fileMergers)
          .then(mergedFiles => {
            mergedFileMap[typeId] = mergedFiles;
          }))
          // activate them all, once per mod type
          .then(() => {
            progress(t('Starting deployment'), 35);
            const deployProgress =
              (name, percent) => progress(t('Deploying: ') + name, 50 + percent / 2);

            const undiscovered = Object.keys(modPaths).filter(typeId => !truthy(modPaths[typeId]));
            let prom = Promise.resolve();
            if (undiscovered.length !== 0) {
              prom = api.showDialog('error', 'Deployment target unknown', {
                text: 'The deployment directory for some mod type(s) ({{ types }}) '
                    + 'is unknown. Mods of these types will not be deployed. '
                    + 'Maybe this/these type(s) require further configuration or '
                    + 'external tools.',
                parameters: {
                  types: undiscovered.join(', '),
                },
              }, [ { label: 'Cancel' }, { label: 'Ignore' } ])
              .then(result => (result.action === 'Cancel')
                  ? Promise.reject(new UserCanceled())
                  : Promise.resolve());
            }
            return prom
              .then(() => Promise.each(
                Object.keys(modPaths).filter(typeId => undiscovered.indexOf(typeId) === -1),
                typeId => deployMods(api,
                                     game.id,
                                     instPath, modPaths[typeId],
                                     sortedModList.filter(mod => (mod.type || '') === typeId),
                                     activator, lastDeployment[typeId],
                                     typeId, new Set(mergedFileMap[typeId]),
                                     genSubDirFunc(game),
                                     deployProgress)
                .then(newActivation => {
                  newDeployment[typeId] = newActivation;
                  return doSaveActivation(api, typeId, modPaths[typeId], newActivation)
                    .catch(err => api.showDialog('error', 'Saving manifest failed', {
                      text: 'Saving the manifest failed (see error below). This could lead to errors '
                          + 'later on, ',
                      message: err.message,
                    }, [

                    ]));
                })))
              .then(() => {
                progress(t('Running post-deployment events'), 99);
                return api.emitAndAwait('did-deploy', profile.id, newDeployment, (title: string) => {
                  progress(title, 99);
                })
              });
          })
          .then(() => {
            progress(t('Preparing game settings'), 100);
            return bakeSettings(api, profile.gameId, sortedModList);
          }));
      })
      .catch(UserCanceled, () => undefined)
      .catch(ProcessCanceled, () => undefined)
      .catch(TemporaryError, err => {
        api.showErrorNotification('Failed to deploy mods, please try again',
                                  err.message, { allowReport: false });
      })
      .catch(err => api.showErrorNotification('Failed to deploy mods', err, {
        allowReport: err.code !== 'EPERM',
      }))
      .finally(() => api.dismissNotification(notificationId));
  };
}

function doSaveActivation(api: IExtensionApi, typeId: string, modPath: string, files: IDeployedFile[]) {
  const state: IState = api.store.getState();
  return saveActivation(typeId, state.app.instanceId, modPath, files)
    .catch(err => api.showDialog('error', 'Saving manifest failed', {
      text: 'Saving the manifest failed (see error below). This could lead to errors '
        + '(e.g. orphaned files in the game directory, external changes not being detected). '
        + 'later on, please either retry or immediately "purge" after this and try deploying again.',
      message: err.stack,
    }, [
      { label: 'Retry' },
      { label: 'Ignore' },
    ])
    .then(result => (result.action === 'Retry') 
      ? doSaveActivation(api, typeId, modPath, files)
      : Promise.resolve()));
}

function genModsSourceAttribute(api: IExtensionApi): ITableAttribute<IMod> {
  return {
    id: 'modSource',
    name: 'Source',
    help: getText('source', api.translate),
    description: 'Source the mod was downloaded from',
    icon: 'database',
    placement: 'both',
    isSortable: true,
    isToggleable: true,
    isDefaultVisible: false,
    supportsMultiple: true,
    calc: mod => {
      if (mod.attributes === undefined) {
        return 'None';
      }
      const source = modSources.find(iter => iter.id === mod.attributes['source']);
      return source !== undefined ? source.name : 'None';
    },
    edit: {
      choices: () => modSources.map(source => ({ key: source.id, text: source.name })),
      onChangeValue: (mods: IMod[], newValue: string) => {
        const store = api.store;
        const state = store.getState();
        const gameMode = activeGameId(state);
        mods.forEach(mod => {
          if (mod.state === 'downloaded') {
            store.dispatch(setDownloadModInfo(mod.id, 'source', newValue));
          } else {
            store.dispatch(setModAttribute(gameMode, mod.id, 'source', newValue));
          }
        });
      },
    },
  };
}

function genValidActivatorCheck(api: IExtensionApi) {
  return () => new Promise<ITestResult>((resolve, reject) => {
    const state = api.store.getState();
    if (supportedActivators(activators, state).length > 0) {
      return resolve(undefined);
    }

    const gameId = activeGameId(state);
    const game = getGame(gameId);
    if (game === undefined) {
      return resolve(undefined);
    }
    const discovery = currentGameDiscovery(state);
    if ((discovery === undefined) || (discovery.path === undefined)) {
      return resolve(undefined);
    }
    const modPaths = game.getModPaths(discovery.path);

    const messages = activators.map((activator) => {
      const supported = allTypesSupported(activator, state, gameId, Object.keys(modPaths));
      return `[*] ${activator.name} - [i]${supported}[/i]`;
    });

    return resolve({
      description: {
        short: 'Mods can\'t be deployed.',
        long: 'With the current settings, mods can\'t be deployed.\n'
          + 'Please read the following error messages from the deployment '
          + 'plugins and fix one of them.\nAt least the "hardlink deployment" '
          + 'can usually be made to work.\n\n[list]'
          + messages.join('\n')
          + '[/list]',
      },
      severity: 'error',
      automaticFix: () => new Promise<void>((fixResolve, fixReject) => {
        api.events.emit('show-main-page', 'application_settings');
        api.store.dispatch(setSettingsPage('Mods'));
        api.events.on('hide-modal', (modal) => {
          if (modal === 'settings') {
            fixResolve();
          }
        });
      }),
    });
  });
}

function attributeExtractor(input: any) {
  return Promise.resolve({
    version: getSafe(input.meta, ['fileVersion'], undefined),
    logicalFileName: getSafe(input.meta, ['logicalFileName'], undefined),
    rules: getSafe(input.meta, ['rules'], undefined),
    category: getSafe(input.meta, ['details', 'category'], undefined),
    description: getSafe(input.meta, ['details', 'description'], undefined),
    author: getSafe(input.meta, ['details', 'author'], undefined),
    homepage: getSafe(input.meta, ['details', 'homepage'], undefined),
    variant: getSafe(input.custom, ['variant'], undefined),
  });
}

function upgradeExtractor(input: any) {
  return Promise.resolve({
    category: getSafe(input.previous, ['category'], undefined),
    customFileName: getSafe(input.previous, ['customFileName'], undefined),
    variant: getSafe(input.previous, ['variant'], undefined),
    notes: getSafe(input.previous, ['notes'], undefined),
  });
}

function cleanupIncompleteInstalls(api: IExtensionApi) {
  const store: Redux.Store<IState> = api.store;

  const { mods } = store.getState().persistent;

  Object.keys(mods).forEach(gameId => {
    Object.keys(mods[gameId]).forEach(modId => {
      const mod = mods[gameId][modId];
      if (mod.state === 'installing') {
        if (mod.installationPath !== undefined) {
          const instPath = installPath(store.getState());
          const fullPath = path.join(instPath, mod.installationPath);
          log('warn', 'mod was not installed completelely and will be removed', { mod, fullPath });
          // this needs to be synchronous because once is synchronous and we have to complete this
          // before the application fires the gamemode-changed event because at that point we
          // create new mods from the unknown directories (especially the .installing ones)
          try {
            fs.removeSync(fullPath);
          } catch (err) {
            if (err.code !== 'ENOENT') {
              log('error', 'failed to clean up', err);
            }
          }
          try {
            fs.removeSync(fullPath + '.installing');
          } catch (err) {
            if (err.code !== 'ENOENT') {
              log('error', 'failed to clean up', err);
            }
          }
        }
        store.dispatch(removeMod(gameId, modId));
      }
    });
  });
}

let blockDeploy: Promise<void> = Promise.resolve();

function once(api: IExtensionApi) {
  const store: Redux.Store<any> = api.store;

  if (installManager === undefined) {
    installManager = new InstallManager(
        (gameId: string) => installPathForGame(store.getState(), gameId));
    installers.forEach((installer: IInstaller) => {
      installManager.addInstaller(installer.priority, installer.testSupported,
                                  installer.install);
    });
  }

  const updateModDeployment = genUpdateModDeployment();
  const deploymentTimer = new Debouncer(
      (manual: boolean, profileId: string, progressCB) => {
        blockDeploy = blockDeploy
          .then(() => updateModDeployment(api, manual, profileId, progressCB));
        return blockDeploy;
      }, 2000);

  api.events.on('deploy-mods', (callback: (err: Error) => void, profileId?: string,
                                progressCB?: (text: string, percent: number) => void) => {
    deploymentTimer.runNow(callback, true, profileId, progressCB);
  });

  api.onAsync('deploy-single-mod', (gameId: string, modId: string, enable?: boolean) => {
    const state: IState = api.store.getState();
    const game = getGame(gameId);
    const discovery = getSafe(state, ['settings', 'gameMode', 'discovered', gameId], undefined);
    if ((game === undefined) || (discovery === undefined)) {
      return Promise.resolve();
    }
    const mod: IMod = getSafe(state, ['persistent', 'mods', game.id, modId], undefined);
    if (mod === undefined) {
      return Promise.resolve();
    }
    const activator = getActivator(state, gameId);
    const dataPath = game.getModPaths(discovery.path)[mod.type || ''];
    const installationPath = installPathForGame(state, gameId);
    
    const subdir = genSubDirFunc(game);
    let normalize: Normalize;
    return getNormalizeFunc(dataPath)
      .then(norm => {
        normalize = norm;
        return loadActivation(api, mod.type, dataPath);
      })
      .then(lastActivation => activator.prepare(dataPath, false, lastActivation, normalize))
      .then(() => (mod !== undefined)
        ? (enable !== false)
          ? activator.activate(path.join(installationPath, mod.installationPath), mod.installationPath, subdir(mod), new Set())
          : activator.deactivate(installationPath, dataPath, mod)
        : Promise.resolve())
      .then(() => activator.finalize(gameId, dataPath, installationPath))
      .then(newActivation => doSaveActivation(api, mod.type, dataPath, newActivation));
  });

  api.events.on('schedule-deploy-mods', (callback: (err: Error) => void, profileId?: string,
                                         progressCB?: (text: string, percent: number) => void) => {
    deploymentTimer.schedule(callback, false, profileId, progressCB);
  });

  api.events.on('purge-mods', (callback: (err: Error) => void) => {
    blockDeploy = blockDeploy.then(() => purgeMods(api)
      .then(() => callback(null))
      .catch(err => callback(err)));
  });

  api.events.on('await-activation', (callback: (err: Error) => void) => {
    deploymentTimer.wait(callback);
  });

  api.events.on('mods-enabled', (mods: string[], enabled: boolean) => {
    const state: IState = api.store.getState();
    const { notifications } = state.session.notifications;
    const notiIds = new Set(notifications.map(noti => noti.id));
    mods.forEach(modId => {
      const notiId = `may-enable-${modId}`;
      if (notiIds.has(notiId)) {
        api.dismissNotification(notiId);
      }
    });
    if (store.getState().settings.automation.deploy) {
      deploymentTimer.schedule(undefined, false);
    }
  });

  api.events.on('gamemode-activated',
      (newMode: string) => onGameModeActivated(api, activators, newMode));

  api.onStateChange(
      ['settings', 'mods', 'installPath'],
      (previous, current) => onPathsChanged(api, previous, current));

  api.events.on('start-install', (archivePath: string,
                                  callback?: (error, id: string) => void) => {
    installManager.install(null, archivePath, [ activeGameId(store.getState()) ],
          api, {
            download: {
              localPath: path.basename(archivePath),
            },
          },
          true, false, callback);
  });

  api.events.on(
      'start-install-download',
      (downloadId: string, callback?: (error, id: string) => void) =>
          onStartInstallDownload(api, installManager, downloadId, callback));

  api.events.on(
      'remove-mod',
      (gameMode: string, modId: string, callback?: (error: Error) => void) =>
          onRemoveMod(api, activators, gameMode, modId, callback));

  api.events.on('create-mod',
      (gameMode: string, mod: IMod, callback: (error: Error) => void) => {
        onAddMod(api, gameMode, mod, callback);
      });

  cleanupIncompleteInstalls(api);
}

function init(context: IExtensionContext): boolean {
  const modsActivity = new ReduxProp(context.api, [
    ['session', 'base', 'activity', 'mods'],
  ], (activity: string[]) => (activity !== undefined) && (activity.length > 0));

  context.registerMainPage('mods', 'Mods',
    LazyComponent(() => require('./views/ModList')), {
    hotkey: 'M',
    group: 'per-game',
    visible: () => activeGameId(context.api.store.getState()) !== undefined,
    activity: modsActivity,
    props: () => ({ modSources }),
  });

  context.registerAction('mod-icons', 105, ActivationButton, {}, () => ({
    key: 'activate-button',
    activators,
  }));

  context.registerAction('mod-icons', 110, DeactivationButton, {}, () => ({
    key: 'deactivate-button',
    activators,
  }));

  const validActivatorCheck = genValidActivatorCheck(context.api);

  context.registerTest('valid-activator', 'gamemode-activated', validActivatorCheck);
  context.registerTest('valid-activator', 'settings-changed', validActivatorCheck);

  context.registerSettings('Mods', LazyComponent(() => require('./views/Settings')),
                           () => ({activators}));

  context.registerDialog('external-changes',
                         LazyComponent(() => require('./views/ExternalChangeDialog')));

  context.registerReducer(['session', 'externalChanges'], externalChangesReducer);
  context.registerReducer(['settings', 'mods'], settingsReducer);
  context.registerReducer(['persistent', 'mods'], modsReducer);

  context.registerTableAttribute('mods', genModsSourceAttribute(context.api));

  context.registerDeploymentMethod = registerDeploymentMethod;
  context.registerInstaller = registerInstaller;
  context.registerAttributeExtractor = registerAttributeExtractor;
  context.registerModSource = registerModSource;
  context.registerMerge = registerMerge;

  registerAttributeExtractor(100, attributeExtractor);
  registerAttributeExtractor(200, upgradeExtractor);

  registerInstaller('fallback', 1000, basicInstaller.testSupported, basicInstaller.install);

  context.once(() => once(context.api));

  return true;
}

export default init;
