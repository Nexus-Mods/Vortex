import { dismissNotification, ICheckbox, updateNotification } from '../../actions/notifications';
import { setSettingsPage, startActivity, stopActivity } from '../../actions/session';
import {
  IExtensionApi,
  IExtensionContext,
  IModSourceOptions,
  MergeFunc,
  MergeTest,
} from '../../types/IExtensionContext';
import {IGame, IModType} from '../../types/IGame';
import { INotification } from '../../types/INotification';
import {IDiscoveryResult, IState} from '../../types/IState';
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
  modPathsForGame,
} from '../../util/selectors';
import {getSafe} from '../../util/storeHelper';
import { isChildPath, truthy } from '../../util/util';

import {setDownloadModInfo} from '../download_management/actions/state';
import {getGame} from '../gamemode_management/util/getGame';
import { getModType } from '../gamemode_management/util/modTypeExtensions';
import { setModEnabled } from '../profile_management/actions/profiles';
import { IProfile, IProfileMod } from '../profile_management/types/IProfile';

import { setDeploymentNecessary } from './actions/deployment';
import {removeMod, setModAttribute} from './actions/mods';
import { setDeploymentProblem } from './actions/session';
import {setTransferMods} from './actions/transactions';
import {deploymentReducer} from './reducers/deployment';
import {modsReducer} from './reducers/mods';
import {sessionReducer} from './reducers/session';
import {settingsReducer} from './reducers/settings';
import {transactionsReducer} from './reducers/transactions';
import {IDeployedFile, IDeploymentMethod, IUnavailableReason} from './types/IDeploymentMethod';
import {IFileMerge} from './types/IFileMerge';
import {IMod} from './types/IMod';
import {IModSource} from './types/IModSource';
import {InstallFunc} from './types/InstallFunc';
import {IResolvedMerger} from './types/IResolvedMerger';
import {TestSupported} from './types/TestSupported';
import { fallbackPurge, loadActivation,
        saveActivation, withActivationLock } from './util/activationStore';
import allTypesSupported from './util/allTypesSupported';
import * as basicInstaller from './util/basicInstaller';
import { genSubDirFunc, purgeMods, purgeModsInPath } from './util/deploy';
import { getAllActivators, getCurrentActivator, getSelectedActivator,
         getSupportedActivators, registerDeploymentMethod } from './util/deploymentMethods';
import { NoDeployment } from './util/exceptions';
import { dealWithExternalChanges } from './util/externalChanges';
import { registerAttributeExtractor } from './util/filterModInfo';
import renderModName from './util/modName';
import sortMods, { CycleError } from './util/sort';
import ActivationButton from './views/ActivationButton';
import DeactivationButton from './views/DeactivationButton';
import {} from './views/ExternalChangeDialog';
import {} from './views/FixDeploymentDialog';
import {} from './views/ModList';
import {} from './views/Settings';
import Workarounds from './views/Workarounds';

import { onAddMod, onGameModeActivated, onModsChanged, onPathsChanged,
         onRemoveMod, onStartInstallDownload } from './eventHandlers';
import InstallManager from './InstallManager';
import deployMods from './modActivation';
import mergeMods, { MERGED_PATH } from './modMerging';
import preStartDeployHook from './preStartDeployHook';
import getText from './texts';

import Promise from 'bluebird';
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

function registerModSource(id: string,
                           name: string,
                           onBrowse: () => void,
                           options?: IModSourceOptions) {
  modSources.push({ id, name, onBrowse, options });
}

function registerMerge(test: MergeTest, merge: MergeFunc, modType: string) {
  mergers.push({ test, merge, modType });
}

function bakeSettings(api: IExtensionApi, profile: IProfile, sortedModList: IMod[]) {
  return api.emitAndAwait('bake-settings', profile.gameId, sortedModList, profile);
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

function deployModType(api: IExtensionApi,
                       activator: IDeploymentMethod,
                       game: IGame,
                       sortedModList: IMod[],
                       typeId: string,
                       stagingPath: string,
                       targetPath: string,
                       overwritten: IMod[],
                       mergeResult: { [modType: string]: IMergeResultByType },
                       lastDeployment: IDeployedFile[],
                       onProgress: (text: string, perc: number) => void): Promise<IDeployedFile[]> {
  const filteredModList = sortedModList.filter(mod => (mod.type || '') === typeId);
  log('debug', 'Deploying mod type',
    { typeId, path: targetPath, count: lastDeployment.length });
  let normalize: Normalize;

  return getNormalizeFunc(targetPath)
    .then(normalizeIn => {
      normalize = normalizeIn;
      return deployMods(api,
                        game.id,
                        stagingPath, targetPath,
                        filteredModList,
                        activator, lastDeployment,
                        typeId, new Set(mergeResult[typeId]?.usedInMerge ?? []),
                        genSubDirFunc(game, getModType(typeId)),
                        onProgress);
      })
    .then((newActivation: IDeployedFile[]) => {
      const mergedMap = mergeResult[typeId]?.mergeInfluences;
      if (!!mergedMap && (Object.keys(mergedMap).length > 0)) {
        newActivation.forEach(act => {
          const merged = Array.from(new Set(mergedMap[normalize(act.relPath)]));
          if (merged.length > 0) {
            act.merged = merged;
          }
        });
      }
      overwritten.push(...filteredModList.filter(mod =>
        newActivation.find(entry =>
          (entry.source === mod.installationPath)
          || ((entry.merged || []).includes(mod.id))) === undefined));

      return doSaveActivation(api, typeId,
        targetPath, stagingPath,
        newActivation, activator.id)
        .catch(err => api.showDialog('error', 'Saving manifest failed', {
          text: 'Saving the manifest failed (see error below). '
            + 'This could lead to errors later on, ',
          message: err.message,
        }, []))
        .then(() => newActivation);
    });
}

function deployAllModTypes(api: IExtensionApi,
                           activator: IDeploymentMethod,
                           profile: IProfile,
                           sortedModList: IMod[],
                           stagingPath: string,
                           mergeResult: { [modType: string]: IMergeResultByType },
                           modPaths: { [typeId: string]: string },
                           lastDeployment: { [typeId: string]: IDeployedFile[] },
                           newDeployment: { [typeId: string]: IDeployedFile[] },
                           onProgress: (text: string, perc: number) => void) {
  const game = getGame(profile.gameId);
  const overwritten: IMod[] = [];

  api.dismissNotification('redundant-mods');

  return Promise.each(deployableModTypes(modPaths),
    typeId => deployModType(api, activator, game, sortedModList, typeId,
      stagingPath, modPaths[typeId], overwritten, mergeResult,
      lastDeployment[typeId], onProgress)
      .then(deployment => newDeployment[typeId] = deployment))
    .then(() => {
      if (activator.noRedundancy !== true) {
        return reportRedundant(api, profile.id, overwritten);
      } else {
        return Promise.resolve();
      }
    });
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
      new ProcessCanceled('Deployment is not possible when you have cyclical mod rules. '
                          + err.message)));
}

interface IMergeResultByType {
  usedInMerge: string[];
  mergeInfluences: { [outPath: string]: string[] };
}

function doMergeMods(api: IExtensionApi,
                     game: IGame,
                     gameDiscovery: IDiscoveryResult,
                     stagingPath: string,
                     sortedModList: IMod[],
                     modPaths: { [typeId: string]: string },
                     lastDeployment: { [typeId: string]: IDeployedFile[] }):
    Promise<{ [typeId: string]: IMergeResultByType }> {

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

  const result: { [typeId: string]: IMergeResultByType } = Object.keys(modPaths)
    .reduce((prev, modType) => {
      prev[modType] = { usedInMerge: [], mergeInfluences: { } };
      return prev;
    }, {});

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
        .then(mergeResult => {
          // some transformation required because in a merge we may use files from one modtype
          // to generate a file for another. usedInMerge is used to skip files already applied to
          // a merge so we need that information when processing the mod type where the merge source
          // came from.
          // However the list of sources used to generate a merge we need in the modtype used to
          // deploy the merge

          const { usedInMerge, mergeInfluences } = mergeResult;
          result[typeId].usedInMerge = usedInMerge;
          Object.keys(mergeInfluences)
            .forEach(outPath => {
              result[mergeInfluences[outPath].modType].mergeInfluences[outPath] = [
                ...(result[mergeInfluences[outPath].modType].mergeInfluences[outPath] ?? []),
                ...mergeInfluences[outPath].sources,
              ];
            });
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
              bbcode: 'Some of the enabled mods either contain no files or all files '
                + 'they do contain are entirely overwritten by another mod. '
                + 'These redundant mods don\'t do any harm except slow down '
                + 'deployment a bit.\n'
                + 'If you believe this to be a mistake, please check the file '
                + 'conflicts [svg]conflict[/svg] for the mod in question.',
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
          },
        },
      ],
    });
  }
  return Promise.resolve();
}

function deployableModTypes(modPaths: { [typeId: string]: string }) {
  return Object.keys(modPaths)
    .filter(typeId => truthy(modPaths[typeId]));
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
    const state = api.store.getState();
    let profile: IProfile = profileId !== undefined
      ? getSafe(state, ['persistent', 'profiles', profileId], undefined)
      : activeProfile(state);

    if (Object.keys(getSafe(state, ['session', 'base', 'toolsRunning'], {})).length > 0) {
      api.sendNotification({
        type: 'info',
        id: 'deployment-not-possible',
        message: 'Can\'t deploy while the game or a tool is running',
        displayMS: 5000,
      });
      return Promise.resolve();
    }

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
      if (selectedActivator !== undefined) {
        if (err.errors.length > 0) {
          api.showErrorNotification('Deployment not possible',
            t('Deployment method "{{method}}" not available because: {{reason}}', {
              replace: {
                method: selectedActivator.name,
                reason: err.errors[0].description(t),
              },
            }), {
            id: 'deployment-not-possible',
            allowReport: false,
          });
        } else if (err.warnings.length > 0) {
          api.sendNotification({
            type: 'warning',
            message: t('Deployment method "{{method}}" does not support '
                        + 'all mod types: {{reason}}', {
              replace: {
                method: selectedActivator.name,
                reason: err.warnings[0].description(t),
              },
            }),
            allowSuppress: true,
          });
        }
      } // otherwise there should already be a notification
      return Promise.resolve();
    }

    const newDeployment: { [typeId: string]: IDeployedFile[] } = {};

    // will contain all mods fully overwritten (this also includes mods that didn't
    // files to begin with)
    let sortedModList: IMod[];

    const userGate = () => {
      if (game.deploymentGate !== undefined) {
        return game.deploymentGate();
      } else {
        return activator.userGate();
      }
    };

    // test if anything was changed by an external application
    return (manual ? Promise.resolve() : userGate())
      .tap(() => {
        notification.id = api.sendNotification(notification);
      })
      .then(() => withActivationLock(() => {
        log('debug', 'deploying mods', {
          game: gameId,
          profile: profile?.id,
          method: activator.name,
        });

        let mergeResult: { [modType: string]: IMergeResultByType };
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
          .then(() => {
            // need to update the profile so that if a will-deploy handler disables a mod, that
            // actually has an affect on this deployment
            const updatedState = api.getState();
            const updatedProfile = updatedState.persistent.profiles[profile.id];
            if (updatedProfile !== undefined) {
              profile = updatedProfile;
            } else {
              // I don't think this can happen
              log('warn', 'profile no longer found?', profileId);
            }
          })
          .tap(() => progress(t('Checking for external changes'), 5))
          .then(() => dealWithExternalChanges(api, activator, profileId, stagingPath, modPaths,
            lastDeployment))
          .tap(() => progress(t('Sorting mods'), 30))
          .then(() => doSortMods(api, profile, mods)
            .then((sortedModListIn: IMod[]) => {
              sortedModList = sortedModListIn;
            }))
          .tap(() => progress(t('Merging mods'), 35))
          .then(() => doMergeMods(api, game, gameDiscovery, stagingPath, sortedModList,
                                  modPaths, lastDeployment)
            .then(mergeResultIn => mergeResult = mergeResultIn))
          .tap(() => progress(t('Starting deployment'), 35))
          .then(() => {
            const deployProgress = (name, percent) =>
              progress(t('Deploying: ') + name, 50 + percent / 2);

            const undiscovered = Object.keys(modPaths)
              .filter(typeId => !truthy(modPaths[typeId]));
            return validateDeploymentTarget(api, undiscovered)
              .then(() => deployAllModTypes(api, activator, profile, sortedModList,
                                            stagingPath, mergeResult,
                                            modPaths, lastDeployment,
                                            newDeployment, deployProgress));
          });
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
                },
              },
            ],
          });
        })
        .catch(err => {
          if ((err.code === undefined) && (err.errno !== undefined)) {
            // unresolved windows error code
            return api.showErrorNotification('Failed to deploy mods', {
              error: err,
              ErrorCode: err.errno,
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
    };
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
    isGroupable: true,
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
      choices: () => modSources
        .filter(source => {
          if ((source.options === undefined) || (source.options.condition === undefined)) {
            return true;
          }
          return source.options.condition();
        })
        .map(source => {
          const icon = ((source.options !== undefined) && (source.options.icon !== undefined))
            ? source.options.icon
            : undefined;
          return { key: source.id, text: source.name, icon };
        }),
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
    const modPaths = modPathsForGame(state, gameId);

    if (modPaths === undefined) {
      return resolve(undefined);
    }

    type IUnavailableReasonEx = IUnavailableReason & { activator?: string };

    const reasons: IUnavailableReasonEx[] = getAllActivators().map(activator => {
      const problems = allTypesSupported(activator, state, gameId, Object.keys(modPaths));
      return { activator: activator.id, ...problems.errors[0] };
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
    source: input.meta?.source,
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

    const subdir = genSubDirFunc(game, getModType(mod.type));
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
          : activator.deactivate(modPath, subdir(mod), mod.installationPath)
        : Promise.resolve())
      .tapCatch(() => {
        if (activator.cancel !== undefined) {
          activator.cancel(gameId, dataPath, stagingPath);
        }
      })
      .then(() => activator.finalize(gameId, dataPath, stagingPath))
      .then(newActivation =>
        doSaveActivation(api, mod.type, dataPath, stagingPath, newActivation, activator.id))
      .catch(ProcessCanceled, err => {
        api.sendNotification({
          type: 'warning',
          title: 'Deployment interrupted',
          message: err.message,
        });
      })
      .catch(err => {
        const userCanceled = err instanceof UserCanceled;
        api.showErrorNotification('Failed to deploy mod', err, {
          message: modId,
          allowReport: !userCanceled,
        });
      })).then(() => null);
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
      installManager.addInstaller(installer.id, installer.priority, installer.testSupported,
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

  api.onAsync('purge-mods-in-path', (gameId: string, modType: string, modPath: string) => {
    return purgeModsInPath(api, gameId, modType, modPath)
      .catch(UserCanceled, () => Promise.resolve())
      .catch(NoDeployment, () => {
        api.showErrorNotification('Failed to purge mods',
          'No deployment method currently available',
          { allowReport: false });
      })
      .catch(ProcessCanceled, err =>
        api.showErrorNotification('Failed to purge mods', err, { allowReport: false }))
      .catch(err => api.showErrorNotification('Failed to purge mods', err));
  });

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
      (downloadId: string, allowAutoEnable?: boolean, callback?: (error, id: string) => void,
       forceInstaller?: string) =>
          onStartInstallDownload(api, installManager, downloadId, allowAutoEnable,
                                 forceInstaller, callback));

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

  log('debug', '[checking staging folder]', { gameMode });
  if (gameMode === undefined) {
    return Promise.resolve(result);
  }

  const discovery = currentGameDiscovery(state);
  const instPath = installPath(state);
  const basePath = getVortexPath('application');
  log('debug', '[checking staging folder]',
    { stagingPath: instPath, vortexPath: basePath, gamePath: discovery?.path });
  if (isChildPath(instPath, basePath)) {
    result = {
      severity: 'warning',
      description: {
        short: 'Invalid staging folder',
        long: 'Your mod staging folder is inside the Vortex application directory. '
          + 'This is a very bad idea because that folder gets removed during updates so you would '
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

  context.registerActionCheck('SET_MOD_INSTALLATION_PATH', (state, action: any) => {
    if (!truthy(action.payload.installPath)) {
      return `Attempt to set an invalid mod installation path`;
    }

    return undefined;
  });

  context.registerTest('valid-activator', 'gamemode-activated', validActivatorCheck);
  context.registerTest('valid-activator', 'settings-changed', validActivatorCheck);

  context.registerSettings('Mods', LazyComponent(() => require('./views/Settings')),
                           () => ({activators: getAllActivators()}), undefined, 75);
  context.registerSettings('Workarounds', Workarounds, undefined, undefined, 1000);

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

  context.registerActionCheck('ADD_MOD', (state, action: any) => {
    const { mod }: { mod: IMod } = action.payload;
    if (!truthy(mod.installationPath)) {
      return 'Can\'t create mod without installation path';
    }

    return undefined;
  });

  context.registerActionCheck('ADD_MODS', (state, action: any) => {
    const { mods }: { mods: IMod[] } = action.payload;
    if (mods.find(iter => !truthy(iter.installationPath)) !== undefined) {
      return 'Can\'t create mod without installation path';
    }

    return undefined;
  });

  registerAttributeExtractor(150, attributeExtractor);
  registerAttributeExtractor(10, upgradeExtractor);

  registerInstaller('fallback', 1000, basicInstaller.testSupported, basicInstaller.install);

  context.registerStartHook(100, 'check-deployment',
                            input => preStartDeployHook(context.api, input));

  context.once(() => once(context.api));

  return true;
}

export default init;
