import { dismissNotification, ICheckbox, updateNotification } from '../../actions/notifications';
import { setSettingsPage, startActivity, stopActivity } from '../../actions/session';
import {
  IExtensionApi,
  IExtensionContext,
  MergeFunc,
  MergeTest,
} from '../../types/IExtensionContext';
import {IGame} from '../../types/IGame';
import { INotification } from '../../types/INotification';
import {IState, IDiscoveryResult} from '../../types/IState';
import { ITableAttribute } from '../../types/ITableAttribute';
import {ITestResult} from '../../types/ITestResult';
import { ProcessCanceled, TemporaryError, UserCanceled } from '../../util/CustomErrors';
import Debouncer from '../../util/Debouncer';
import * as fs from '../../util/fs';
import getNormalizeFunc, { Normalize } from '../../util/getNormalizeFunc';
import getVortexPath from '../../util/getVortexPath';
import LazyComponent from '../../util/LazyComponent';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import onceCB from '../../util/onceCB';
import ReduxProp from '../../util/ReduxProp';
import {
  activeGameId,
  activeProfile,
  currentGameDiscovery,
  installPath,
  installPathForGame,
} from '../../util/selectors';
import {getSafe} from '../../util/storeHelper';
import { isChildPath, setdefault, truthy } from '../../util/util';

import {setDownloadModInfo} from '../download_management/actions/state';
import {getGame} from '../gamemode_management/util/getGame';
import { setModEnabled } from '../profile_management/actions/profiles';
import { IProfile, IProfileMod } from '../profile_management/types/IProfile';

import { setDeploymentNecessary } from './actions/deployment';
import {removeMod, setModAttribute} from './actions/mods';
import { setDeploymentProblem, showExternalChanges } from './actions/session';
import {setTransferMods} from './actions/transactions';
import {deploymentReducer} from './reducers/deployment';
import {modsReducer} from './reducers/mods';
import {sessionReducer} from './reducers/session';
import {settingsReducer} from './reducers/settings';
import {transactionsReducer} from './reducers/transactions';
import {IDeployedFile, IFileChange, IUnavailableReason, IDeploymentMethod} from './types/IDeploymentMethod';
import {IFileEntry} from './types/IFileEntry';
import {IFileMerge} from './types/IFileMerge';
import {IMod} from './types/IMod';
import {IModSource} from './types/IModSource';
import {InstallFunc} from './types/InstallFunc';
import {IResolvedMerger} from './types/IResolvedMerger';
import {TestSupported} from './types/TestSupported';
import { loadActivation, saveActivation, fallbackPurge, withActivationLock } from './util/activationStore';
import allTypesSupported from './util/allTypesSupported';
import * as basicInstaller from './util/basicInstaller';
import { purgeMods } from './util/deploy';
import { getAllActivators, getCurrentActivator, getSelectedActivator,
         getSupportedActivators, registerDeploymentMethod } from './util/deploymentMethods';
import { NoDeployment } from './util/exceptions';
import { registerAttributeExtractor } from './util/filterModInfo';
import getModPaths from './util/getModPaths';
import renderModName from './util/modName';
import sortMods, { CycleError } from './util/sort';
import ActivationButton from './views/ActivationButton';
import DeactivationButton from './views/DeactivationButton';
import {} from './views/ExternalChangeDialog';
import {} from './views/FixDeploymentDialog';
import {} from './views/ModList';
import {} from './views/Settings';

import { onAddMod, onGameModeActivated, onModsChanged, onPathsChanged,
         onRemoveMod, onStartInstallDownload } from './eventHandlers';
import InstallManager from './InstallManager';
import deployMods from './modActivation';
import mergeMods, { MERGED_PATH } from './modMerging';
import preStartDeployHook from './preStartDeployHook';
import getText from './texts';

import * as Promise from 'bluebird';
import * as path from 'path';
import * as Redux from 'redux';
import shortid = require('shortid');

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
    const action = (value.action === 'newest')
      ? (value.sourceModified > value.destModified) ? 'drop' : 'import'
      : value.action;

    setdefault(prev, action, []).push(value);
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
          .then(() => fs.copyAsync(deployed, source))
          .catch({ code: 'ENOENT' }, (err: any) => log('warn', 'file disappeared', err.path));
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

function bakeSettings(api: IExtensionApi, profile: IProfile, sortedModList: IMod[]) {
  return api.emitAndAwait('bake-settings', profile.gameId, sortedModList, profile);
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

function showCycles(api: IExtensionApi, cycles: string[][], gameId: string) {
  const id = shortid();
  return api.showDialog('error', 'Cycles', {
    text: 'Dependency rules between your mods contain cycles, '
      + 'like "A after B" and "B after A". You need to remove one of the '
      + 'rules causing the cycle, otherwise your mods can\'t be '
      + 'applied in the right order.',
    links: cycles.map((cycle, idx) => (
      { label: cycle.join(', '), action: () => {
        api.closeDialog(id);
        api.events.emit('edit-mod-cycle', gameId, cycle);
      } }
    )),
  }, [
    { label: 'Close' },
  ], id);
}

function checkForExternalChanges(api: IExtensionApi,
                                 activator: IDeploymentMethod,
                                 profileId: string,
                                 stagingPath: string,
                                 modPaths: { [typeId: string]: string },
                                 lastDeployment: { [typeId: string]: IDeployedFile[] }) {
  // for each mod type, check if the local files were changed outside vortex
  const changes: { [typeId: string]: IFileChange[] } = {};
  log('debug', 'determine external changes');
  // update mod state again because if the user did have to confirm,
  // it's more intuitive if we deploy the state at the time he confirmed, not when
  // the deployment was triggered
  const state = api.store.getState();

  const profile = profileId !== undefined
    ? getSafe(state, ['persistent', 'profiles', profileId], undefined)
    : activeProfile(state);
  if (profile === undefined) {
    return Promise.reject(new ProcessCanceled('Profile no longer exists.'));
  }
  return Promise.each(Object.keys(modPaths),
    typeId => {
      log('debug', 'checking external changes',
        { modType: typeId, count: lastDeployment[typeId].length });
      return activator.externalChanges(profile.gameId, stagingPath, modPaths[typeId],
        lastDeployment[typeId])
        .then(fileChanges => {
          if (fileChanges.length > 0) {
            changes[typeId] = fileChanges;
          }
        });
    })
    .then(() => changes);
}

function dealWithExternalChanges(api: IExtensionApi,
                                 activator: IDeploymentMethod,
                                 profileId: string,
                                 stagingPath: string,
                                 modPaths: { [typeId: string]: string },
                                 lastDeployment: { [typeId: string]: IDeployedFile[] }) {
  return checkForExternalChanges(api, activator, profileId, stagingPath, modPaths,
    lastDeployment)
    .then((changes: { [typeId: string]: IFileChange[] }) => (Object.keys(changes).length === 0)
      ? Promise.resolve([])
      : api.store.dispatch(showExternalChanges(changes)))
    .then((fileActions: IFileEntry[]) => Promise.mapSeries(Object.keys(lastDeployment),
      typeId => applyFileActions(stagingPath, modPaths[typeId],
        lastDeployment[typeId],
        fileActions.filter(action => action.modTypeId === typeId))
        .then(newLastDeployment => lastDeployment[typeId] = newLastDeployment)))
}

function deployModType(api: IExtensionApi,
                       activator: IDeploymentMethod,
                       game: IGame,
                       sortedModList: IMod[],
                       typeId: string,
                       stagingPath: string,
                       targetPath: string,
                       overwritten: IMod[],
                       mergedFileMap: { [modType: string]: string[] },
                       lastDeployment: IDeployedFile[],
                       onProgress: (text: string, perc: number) => void): Promise<IDeployedFile[]> {
  const filteredModList = sortedModList.filter(mod => (mod.type || '') === typeId);
  log('debug', 'Deploying mod type',
    { typeId, path: targetPath, count: lastDeployment.length });
  return deployMods(api,
                    game.id,
                    stagingPath, targetPath,
                    filteredModList,
                    activator, lastDeployment,
                    typeId, new Set(mergedFileMap[typeId]),
                    genSubDirFunc(game),
                    onProgress)
    .then(newActivation => {
      overwritten.push(...filteredModList.filter(mod =>
        newActivation.find(entry =>
          entry.source === mod.installationPath) === undefined));

      return doSaveActivation(api, typeId,
        targetPath, stagingPath,
        newActivation, activator.id)
        .catch(err => api.showDialog('error', 'Saving manifest failed', {
          text: 'Saving the manifest failed (see error below). '
            + 'This could lead to errors later on, ',
          message: err.message,
        }, []))
        .then(() => newActivation)
    });
}

function deployAllModTypes(api: IExtensionApi,
                       activator: IDeploymentMethod,
                       profile: IProfile,
                       sortedModList: IMod[],
                       stagingPath: string,
                       mergedFileMap: { [modType: string]: string[] },
                       modPaths: { [typeId: string]: string },
                       lastDeployment: { [typeId: string]: IDeployedFile[] },
                       newDeployment: { [typeId: string]: IDeployedFile[] },
                       onProgress: (text: string, perc: number) => void) {
  const game = getGame(profile.gameId);
  const overwritten: IMod[] = [];

  return Promise.each(deployableModTypes(modPaths),
    typeId => deployModType(api, activator, game, sortedModList, typeId,
      stagingPath, modPaths[typeId], overwritten, mergedFileMap,
      lastDeployment[typeId], onProgress)
      .then(deployment => newDeployment[typeId] = deployment))
    .then(() => reportRedundant(api, profile.id, overwritten));
}

function validateDeploymentTarget(api: IExtensionApi, undiscovered: string[]) {
  if (undiscovered.length === 0) {
    return Promise.resolve();
  }
  return api.showDialog('error', 'Deployment target unknown', {
    text: 'The deployment directory for some mod type(s) ({{ types }}) '
      + 'is unknown. Mods of these types will not be deployed. '
      + 'Maybe this/these type(s) require further configuration or '
      + 'external tools.',
    parameters: {
      types: undiscovered.join(', '),
    },
  }, [{ label: 'Cancel' }, { label: 'Ignore' }])
    .then(result => (result.action === 'Cancel')
      ? Promise.reject(new UserCanceled())
      : Promise.resolve());
}

function doSortMods(api: IExtensionApi, profile: IProfile, mods: { [modId: string]: IMod }) {
  // sort (all) mods based on their dependencies so the right files get activated
  const modState: { [id: string]: IProfileMod } =
    profile !== undefined ? profile.modState : {};
  const unsorted = Object.keys(mods)
    .map((key: string) => mods[key])
    .filter((mod: IMod) => getSafe(modState, [mod.id, 'enabled'], false));

  return sortMods(profile.gameId, unsorted, api)
    .catch(CycleError, err => Promise.reject(
      new ProcessCanceled('Deployment is not possible when you have cyclical mod rules. ' + err.message)));
}

function doMergeMods(api: IExtensionApi,
                     game: IGame,
                     gameDiscovery: IDiscoveryResult,
                     stagingPath: string,
                     sortedModList: IMod[],
                     modPaths: { [typeId: string]: string },
                     lastDeployment: { [typeId: string]: IDeployedFile[] }):
    Promise<{ [typeId: string]: string[] }> {

  const fileMergers = mergers.reduce((prev: IResolvedMerger[], merge) => {
    const match = merge.test(game, gameDiscovery);
    if (match !== undefined) {
      prev.push({ match, merge: merge.merge, modType: merge.modType });
    }
    return prev;
  }, []);

  // all mod types that require merging
  const mergeModTypes = Object.keys(modPaths)
    .filter(modType => fileMergers.find(merger => merger.modType === modType) !== undefined);

  const result: { [typeId: string]: string[] } = {};

  // clean up merged mods
  return Promise.mapSeries(mergeModTypes, typeId => {
    const mergePath = truthy(typeId)
      ? MERGED_PATH + '.' + typeId
      : MERGED_PATH;
    return fs.removeAsync(path.join(stagingPath, mergePath));
  })
    // update merged mods
    .then(() => Promise.each(mergeModTypes,
      typeId => mergeMods(api, game, stagingPath, modPaths[typeId],
        sortedModList.filter(mod => (mod.type || '') === typeId),
        lastDeployment[typeId],
        fileMergers)
        .then(mergedFiles => {
          result[typeId] = mergedFiles;
        })))
    .then(() => result);
}

function reportRedundant(api: IExtensionApi, profileId: string, overwritten: IMod[]) {
  if (overwritten.length > 0) {
    api.sendNotification({
      id: 'redundant-mods',
      type: 'info',
      message: 'Some mods are redundant',
      actions: [
        {
          title: 'Show', action: dismiss => {
            return api.showDialog('info', 'Redundant mods', {
              text: 'Some of the enabled mods either contain no files or all files '
                + 'they do contain are entirely overwritten by another mod. '
                + 'These redundant mods don\'t do any harm except slow down '
                + 'deployment a bit.',
              checkboxes: overwritten.map((mod: IMod): ICheckbox => ({
                id: mod.id,
                text: renderModName(mod),
                value: true,
              })),
            }, [
                { label: 'Disable selected' },
                { label: 'Close', default: true },
              ]).then(result => {
                if (result.action === 'Disable selected') {
                  Object.keys(result.input)
                    .filter(modId => result.input[modId])
                    .forEach(modId => {
                      api.store.dispatch(setModEnabled(profileId, modId, false));
                    });
                  dismiss();
                }
              });
          }
        },
      ],
    });
  }
  return Promise.resolve();
}

function deployableModTypes(modPaths: { [typeId: string]: string }) {
  return Object.keys(modPaths)
    .filter(typeId => truthy(modPaths[typeId]))
}

function genUpdateModDeployment() {
  return (api: IExtensionApi, manual: boolean, profileId?: string,
          progressCB?: (text: string, percent: number) => void): Promise<void> => {
    const t = api.translate;

    const notification: INotification = {
      type: 'activity',
      message: t('Waiting for other operations to complete'),
      title: t('Deploying'),
    };

    const progress = (text: string, percent: number) => {
      log('debug', 'deployment progress', { text, percent });
      if (progressCB !== undefined) {
        progressCB(text, percent);
      }
      api.store.dispatch(updateNotification(notification.id, percent, text));
    };
    let state = api.store.getState();
    let profile: IProfile = profileId !== undefined
      ? getSafe(state, ['persistent', 'profiles', profileId], undefined)
      : activeProfile(state);
    if (profile === undefined) {
      // Used to report an exception here but I don't think this is an error, the call
      // can be delayed so it's completely possible there is no profile active at the the time
      // or has been deleted by then. Rare but not a bug
      api.store.dispatch(dismissNotification(notification.id));
      return Promise.resolve();
    }
    const gameId = profile.gameId;
    const gameDiscovery =
      getSafe(state, ['settings', 'gameMode', 'discovered', gameId], undefined);
    const game = getGame(gameId);
    if ((game === undefined)
        || (gameDiscovery === undefined)
        || (gameDiscovery.path === undefined)) {
      return Promise.reject(new Error('Game no longer available'));
    }
    const stagingPath = installPathForGame(state, gameId);

    const modPaths = game.getModPaths(gameDiscovery.path);
    const activator = getCurrentActivator(state, gameId, true);

    if (activator === undefined) {
      const selectedActivator = getSelectedActivator(state, gameId);
      const types = deployableModTypes(modPaths);

      const err = allTypesSupported(selectedActivator, state, gameId, types);
      if ((selectedActivator !== undefined) && (err !== undefined)) {
        api.showErrorNotification('Deployment not possible', err.description(t), {
          id: 'deployment-not-possible',
          allowReport: false,
        });
      } // otherwise there should already be a notification
      return Promise.resolve();
    }

    const newDeployment: { [typeId: string]: IDeployedFile[] } = {};

    // will contain all mods fully overwritten (this also includes mods that didn't
    // files to begin with)
    let sortedModList: IMod[];

    // test if anything was changed by an external application
    return (manual ? Promise.resolve() : activator.userGate())
      .tap(() => {
        notification.id = api.sendNotification(notification);
      })
      .then(() => withActivationLock(() => {
        let mergedFileMap: { [modType: string]: string[] };
        const lastDeployment: { [typeId: string]: IDeployedFile[] } = {};
        const mods = state.persistent.mods[profile.gameId] || {};
        notification.message = t('Deploying mods');
        api.sendNotification(notification);
        api.store.dispatch(startActivity('mods', 'deployment'));
        progress(t('Loading deployment manifest'), 0);

        return Promise.each(deployableModTypes(modPaths), typeId =>
            loadActivation(api, typeId, modPaths[typeId], stagingPath, activator)
              .then(deployedFiles => lastDeployment[typeId] = deployedFiles))
          .tap(() => progress(t('Running pre-deployment events'), 2))
          .then(() => api.emitAndAwait('will-deploy', profile.id, lastDeployment))
          .tap(() => progress(t('Checking for external changes'), 5))
          .then(() => dealWithExternalChanges(api, activator, profileId, stagingPath, modPaths,
            lastDeployment))
          .tap(() => progress(t('Sorting mods'), 30))
          .then(() => doSortMods(api, profile, mods)
            .then((sortedModListIn: IMod[]) => {
              sortedModList = sortedModListIn;
            }))
          .tap(() => progress(t('Merging mods'), 35))
          .then(() => doMergeMods(api, game, gameDiscovery, stagingPath, sortedModList, modPaths, lastDeployment)
            .then(mergedFileMapIn => mergedFileMap = mergedFileMapIn ))
          .tap(() => progress(t('Starting deployment'), 35))
          .then(() => {
            const deployProgress = (name, percent) =>
              progress(t('Deploying: ') + name, 50 + percent / 2);

            const undiscovered = Object.keys(modPaths)
              .filter(typeId => !truthy(modPaths[typeId]));
            return validateDeploymentTarget(api, undiscovered)
              .then(() => deployAllModTypes(api, activator, profile, sortedModList,
                                            stagingPath, mergedFileMap,
                                            modPaths, lastDeployment,
                                            newDeployment, deployProgress));
          })
      })
        // at this point the deployment lock gets released so another deployment
        // can be started during post-deployment
        .tap(() => progress(t('Running post-deployment events'), 99))
        .then(() => api.emitAndAwait('did-deploy', profile.id, newDeployment,
          (title: string) => progress(title, 99)))
        .tap(() => progress(t('Preparing game settings'), 100))
        .then(() => bakeSettings(api, profile, sortedModList))
        // finally wrapping up
        .then(() => {
          api.store.dispatch(setDeploymentNecessary(game.id, false));
        })
        .catch(UserCanceled, () => undefined)
        .catch(ProcessCanceled, err => {
          api.sendNotification({
            type: 'warning',
            title: 'Deployment interrupted',
            message: err.message,
          });
        })
        .catch(TemporaryError, err => {
          api.showErrorNotification('Failed to deploy mods, please try again',
            err.message, { allowReport: false });
        })
        .catch(CycleError, err => {
          api.sendNotification({
            id: 'mod-cycle-warning',
            type: 'warning',
            message: 'Mod rules contain cycles',
            actions: [
              {
                title: 'Show', action: () => {
                  showCycles(api, err.cycles, profile.gameId);
                }
              },
            ],
          });
        })
        .catch(err => {
          if ((err.code === undefined) && (err.errno !== undefined)) {
            // unresolved windows error code
            return api.showErrorNotification('Failed to deploy mods', {
              error: err,
              ErrorCode: err.errno
            });
          }
          return api.showErrorNotification('Failed to deploy mods', err, {
            allowReport: (err.code !== 'EPERM') && (err.allowReport !== false),
          });
        })
        .finally(() => {
          api.store.dispatch(stopActivity('mods', 'deployment'));
          api.dismissNotification(notification.id);
        }));
    }
}

function doSaveActivation(api: IExtensionApi, typeId: string,
                          deployPath: string, stagingPath: string,
                          files: IDeployedFile[], activatorId: string) {
  const state: IState = api.store.getState();
  return saveActivation(typeId, state.app.instanceId, deployPath, stagingPath, files, activatorId)
    .catch(err => {
      const canceled = err instanceof UserCanceled;
      let text = canceled
        ? 'You canceled the writing of the manifest file.'
        : 'Saving the manifest failed (see error below).';

      text += 'This could lead to errors '
          + '(e.g. orphaned files in the game directory, external changes not being detected) '
          + 'later on. Please either retry or immediately "purge" after this and try '
          + 'deploying again.';
      return api.showDialog('error', 'Saving manifest failed', {
        text,
        message: canceled ? undefined : err.stack,
      }, [
          { label: 'Retry' },
          { label: 'Ignore' },
        ])
        .then(result => (result.action === 'Retry')
          ? doSaveActivation(api, typeId, deployPath, stagingPath, files, activatorId)
          : Promise.resolve());
    });
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
    if (getSupportedActivators(state).length > 0) {
      return resolve(undefined);
    }

    const gameId = activeGameId(state);
    const modPaths = getModPaths(state, gameId);

    if (modPaths === undefined) {
      return resolve(undefined);
    }

    type IUnavailableReasonEx = IUnavailableReason & { activator?: string };

    const reasons: IUnavailableReasonEx[] = getAllActivators().map(activator => {
      const reason: IUnavailableReasonEx =
        allTypesSupported(activator, state, gameId, Object.keys(modPaths));
      if (reason !== undefined) {
        reason.activator = activator.id;
      }
      return reason;
    });

    if (reasons.indexOf(undefined) !== -1) {
      // why didn't getSupportedActivators not find this? Only reason I can think of
      // is the early-out conditions, getSupportedActivators returns an empty list
      // if the game isn't discovered or not known any more
      return resolve(undefined);
    }

    return resolve({
      description: {
        short: 'Mods can\'t be deployed.',
      },
      severity: 'error',
      automaticFix: () => new Promise<void>((fixResolve, fixReject) => {
        api.store.dispatch(setDeploymentProblem(reasons.map(reason => ({
          activator: reason.activator,
          message: reason.description(api.translate),
          solution: reason.solution !== undefined ? reason.solution(api.translate) : undefined,
          order: reason.order || 1000,
          hasAutomaticFix: reason.fixCallback !== undefined,
        })).sort((lhs, rhs) => lhs.order - rhs.order)));
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
          const instPath = installPathForGame(store.getState(), gameId);
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

function onModsEnabled(api: IExtensionApi, deploymentTimer: Debouncer) {
  return (mods: string[], enabled: boolean, gameId: string) => {
    const { store } = api;
    const state: IState = store.getState();
    const { notifications } = state.session.notifications;
    const notiIds = new Set(notifications.map(noti => noti.id));
    mods.forEach(modId => {
      const notiId = `may-enable-${modId}`;
      if (notiIds.has(notiId)) {
        api.dismissNotification(notiId);
      }
    });
    if (state.settings.automation.deploy) {
      deploymentTimer.schedule(undefined, false);
    } else if (!state.persistent.deployment.needToDeploy[gameId]) {
      store.dispatch(setDeploymentNecessary(gameId, true));
    }
  };
}

function onDeploySingleMod(api: IExtensionApi) {
  return (gameId: string, modId: string, enable?: boolean) => {
    const state: IState = api.store.getState();
    const game = getGame(gameId);
    const discovery = getSafe(state, ['settings', 'gameMode', 'discovered', gameId], undefined);
    if ((game === undefined) || (discovery === undefined) || (discovery.path === undefined)) {
      return Promise.resolve();
    }
    const mod: IMod = getSafe(state, ['persistent', 'mods', game.id, modId], undefined);
    if (mod === undefined) {
      return Promise.resolve();
    }
    const activator = getCurrentActivator(state, gameId, false);

    if (activator === undefined) {
      return Promise.resolve();
    }

    const dataPath = game.getModPaths(discovery.path)[mod.type || ''];
    if (!truthy(dataPath)) {
      return Promise.resolve();
    }
    const stagingPath: string = installPathForGame(state, gameId);
    let modPath: string;

    try {
      modPath = path.join(stagingPath, mod.installationPath);
    } catch (err) { 
      err.StagingPath = stagingPath || '<undefined>';
      err.InstallPath = mod.installationPath || '<undefined>';
      err.GameId = gameId || '<undefined>';
      api.showErrorNotification('Failed to deploy mod', err, {
        message: modId,
      });
      return Promise.resolve();
    }

    const subdir = genSubDirFunc(game);
    let normalize: Normalize;
    return withActivationLock(() => getNormalizeFunc(dataPath)
      .then(norm => {
        normalize = norm;
        return loadActivation(api, mod.type, dataPath, stagingPath, activator);
      })
      .then(lastActivation => activator.prepare(dataPath, false, lastActivation, normalize))
      .then(() => (mod !== undefined)
        ? (enable !== false)
          ? activator.activate(modPath, mod.installationPath, subdir(mod), new Set())
          : activator.deactivate(modPath, subdir(mod))
        : Promise.resolve())
      .tapCatch(() => {
        if (activator.cancel !== undefined) {
          activator.cancel(gameId, dataPath, stagingPath);
        }
      })
      .then(() => activator.finalize(gameId, dataPath, stagingPath))
      .then(newActivation =>
        doSaveActivation(api, mod.type, dataPath, stagingPath, newActivation, activator.id))
      .catch(err => {
        api.showErrorNotification('Failed to deploy mod', err, {
          message: modId,
        });
      })
    ).then(() => null);
  };
}

function onNeedToDeploy(api: IExtensionApi, current: any) {
  if (current) {
    api.sendNotification({
      id: 'deployment-necessary',
      type: 'info',
      message: 'Deployment necessary',
      actions: [
        {
          title: 'Deploy', action: (dismiss) => {
            dismiss();
            api.events.emit('deploy-mods', onceCB((err) => {
              if (err !== null) {
                if (err instanceof UserCanceled) {
                  // Nothing to see here, move along.
                  return;
                } else if (err instanceof NoDeployment) {
                  showError(api.store.dispatch,
                    'You need to select a deployment method in settings',
                    undefined, { allowReport: false });
                } else {
                  showError(api.store.dispatch, 'Failed to activate mods', err);
                }
              }
            }));
          },
        },
      ],
    });
  } else {
    api.dismissNotification('deployment-necessary');
  }
}

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
      (manual: boolean, profileId: string, progressCB) =>
        updateModDeployment(api, manual, profileId, progressCB), 2000);

  api.events.on('deploy-mods', (callback: (err: Error) => void, profileId?: string,
                                progressCB?: (text: string, percent: number) => void) => {
    if (!(callback as any).called) {
      deploymentTimer.runNow(callback, true, profileId, progressCB);
    }
  });

  api.onAsync('deploy-single-mod', onDeploySingleMod(api));

  api.events.on('purge-mods', (allowFallback: boolean, callback: (err: Error) => void) => {
    purgeMods(api)
      .catch(err => allowFallback
        ? fallbackPurge(api)
        : Promise.reject(err))
      .then(() => callback(null))
      .catch(err => callback(err));
  });

  api.events.on('await-activation', (callback: (err: Error) => void) => {
    deploymentTimer.wait(callback);
  });

  api.events.on('mods-enabled', onModsEnabled(api, deploymentTimer));

  api.events.on('gamemode-activated',
      (newMode: string) => onGameModeActivated(api, getAllActivators(), newMode));

  api.onStateChange(
      ['settings', 'mods', 'installPath'],
      (previous, current) => onPathsChanged(api, previous, current));

  api.onStateChange(
      ['persistent', 'mods'],
      (previous, current) => onModsChanged(api, previous, current));

  api.onStateChange(
      ['persistent', 'deployment', 'needToDeploy'],
    (previous, current) => {
      const gameMode = activeGameId(store.getState());
      if (previous[gameMode] !== current[gameMode]) {
        onNeedToDeploy(api, current[gameMode]);
      }
    },
  );

  api.events.on('start-install', (archivePath: string,
                                  callback?: (error, id: string) => void) => {
    const { enable } = api.store.getState().settings.automation;
    installManager.install(null, archivePath, [ activeGameId(store.getState()) ],
          api, {
            download: {
              localPath: path.basename(archivePath),
            },
          },
          true, enable, callback);
  });

  api.events.on(
      'start-install-download',
      (downloadId: string, allowAutoEnable?: boolean, callback?: (error, id: string) => void) =>
          onStartInstallDownload(api, installManager, downloadId, allowAutoEnable, callback));

  api.events.on(
      'remove-mod',
      (gameMode: string, modId: string, callback?: (error: Error) => void) =>
          onRemoveMod(api, getAllActivators(), gameMode, modId, callback));

  api.events.on('create-mod',
      (gameMode: string, mod: IMod, callback: (error: Error) => void) => {
        onAddMod(api, gameMode, mod, callback);
      });

  api.events.on('profile-will-change', () => {
    // when the profile changes there is a good chance the cycle warning doesn't apply and if
    // the game changes the cycle dialog can't even be opened or it would trigger an error
    api.dismissNotification('mod-cycle-warning');
  });

  cleanupIncompleteInstalls(api);
}

function checkPendingTransfer(api: IExtensionApi): Promise<ITestResult> {
  let result: ITestResult;
  const state = api.store.getState();

  const gameMode = activeGameId(state);
  if (gameMode === undefined) {
    return Promise.resolve(result);
  }

  const pendingTransfer: string[] = ['persistent', 'transactions', 'transfer', gameMode];
  const transferDestination = getSafe(state, pendingTransfer, undefined);
  if (transferDestination === undefined) {
    return Promise.resolve(result);
  }

  result = {
    severity: 'warning',
    description: {
      short: 'Folder transfer was interrupted',
      long: 'An attempt to move the staging folder was interrupted. You should let '
          + 'Vortex clean up now, otherwise you may be left with unnecessary copies of files.',
    },
    automaticFix: () => new Promise<void>((fixResolve, fixReject) => {
      return fs.removeAsync(transferDestination)
        .then(() => {
          api.store.dispatch(setTransferMods(gameMode, undefined));
          fixResolve();
        })
        .catch(err => {
          if (err.code === 'ENOENT') {
            // Destination is already gone, that's fine.
            api.store.dispatch(setTransferMods(gameMode, undefined));
            fixResolve();
          } else {
            fixReject();
          }
        });
    }),
  };

  return Promise.resolve(result);
}

function checkStagingFolder(api: IExtensionApi): Promise<ITestResult> {
  let result: ITestResult;
  const state = api.store.getState();

  const gameMode = activeGameId(state);
  if (gameMode === undefined) {
    return Promise.resolve(result);
  }

  const discovery = currentGameDiscovery(state);
  const instPath = installPath(state);
  const basePath = getVortexPath('base');
  if (isChildPath(instPath, basePath)) {
    result = {
      severity: 'warning',
      description: {
        short: 'Invalid staging folder',
        long: 'Your mod staging folder is inside the Vortex application directory. '
          + 'This is a very bad idea beckaue that folder gets removed during updates so you would '
          + 'lose all your files on the next update.',
      },
    };
  } else if ((discovery !== undefined)
          && (discovery.path !== undefined)
          && isChildPath(instPath, discovery.path)) {
    result = {
      severity: 'warning',
      description: {
        short: 'Invalid staging folder',
        long: 'Your mod staging folder is inside the game folder.<br/>'
          + 'This is a very bad idea because that folder is under the control of the game '
          + '(and potentially Steam or similar) and may be moved or deleted - e.g. when the '
          + 'game is updated/repaired.<br/>'
          + 'Please choose a separate folder for the staging folder, one that no other '
          + 'application uses.',
      },
      automaticFix: () => new Promise<void>((fixResolve, fixReject) => {
        api.events.emit('show-main-page', 'application_settings');
        api.store.dispatch(setSettingsPage('Mods'));
        api.highlightControl('#install-path-form', 5000);
        api.events.on('hide-modal', (modal) => {
          if (modal === 'settings') {
            fixResolve();
          }
        });
      }),
    };
  }
  return Promise.resolve(result);
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
    activators: getAllActivators(),
  }));

  context.registerAction('mod-icons', 110, DeactivationButton, {}, () => ({
    key: 'deactivate-button',
    activators: getAllActivators(),
  }));

  const validActivatorCheck = genValidActivatorCheck(context.api);

  context.registerTest('valid-activator', 'gamemode-activated', validActivatorCheck);
  context.registerTest('valid-activator', 'settings-changed', validActivatorCheck);

  context.registerSettings('Mods', LazyComponent(() => require('./views/Settings')),
                           () => ({activators: getAllActivators()}));

  context.registerDialog('external-changes',
                         LazyComponent(() => require('./views/ExternalChangeDialog')));
  context.registerDialog('fix-deployment',
    LazyComponent(() => require('./views/FixDeploymentDialog')), () => {
      // nop
    });

  context.registerReducer(['session', 'mods'], sessionReducer);
  context.registerReducer(['settings', 'mods'], settingsReducer);
  context.registerReducer(['persistent', 'mods'], modsReducer);
  context.registerReducer(['persistent', 'deployment'], deploymentReducer);
  context.registerReducer(['persistent', 'transactions'], transactionsReducer);

  context.registerTableAttribute('mods', genModsSourceAttribute(context.api));

  context.registerTest('validate-staging-folder', 'gamemode-activated',
    () => checkStagingFolder(context.api));
  context.registerTest('validate-staging-folder', 'settings-changed',
    () => checkStagingFolder(context.api));
  context.registerTest('verify-mod-transfers', 'gamemode-activated',
    () => checkPendingTransfer(context.api));

  context.registerDeploymentMethod = registerDeploymentMethod;
  context.registerInstaller = registerInstaller;
  context.registerAttributeExtractor = registerAttributeExtractor;
  context.registerModSource = registerModSource;
  context.registerMerge = registerMerge;

  registerAttributeExtractor(100, attributeExtractor);
  registerAttributeExtractor(200, upgradeExtractor);

  registerInstaller('fallback', 1000, basicInstaller.testSupported, basicInstaller.install);

  context.registerStartHook(100, 'check-deployment',
                            input => preStartDeployHook(context.api, input));

  context.once(() => once(context.api));

  return true;
}

export default init;
