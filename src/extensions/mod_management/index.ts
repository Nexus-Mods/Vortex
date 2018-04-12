import { setSettingsPage } from '../../actions/session';
import {
  IExtensionApi,
  IExtensionContext,
  MergeFunc,
  MergeTest,
} from '../../types/IExtensionContext';
import {IGame} from '../../types/IGame';
import {IState, IStatePaths} from '../../types/IState';
import { ITableAttribute, Placement } from '../../types/ITableAttribute';
import {ITestResult} from '../../types/ITestResult';
import { UserCanceled } from '../../util/CustomErrors';
import Debouncer from '../../util/Debouncer';
import * as fs from '../../util/fs';
import LazyComponent from '../../util/LazyComponent';
import { log } from '../../util/log';
import { showError } from '../../util/message';
import ReduxProp from '../../util/ReduxProp';
import {
  activeGameId,
  activeProfile,
  currentActivator,
  currentGameDiscovery,
  installPath,
} from '../../util/selectors';
import {getSafe} from '../../util/storeHelper';
import { removePersistent, setdefault, truthy } from '../../util/util';

import {setDownloadModInfo} from '../download_management/actions/state';
import {IDownload} from '../download_management/types/IDownload';
import {getGame} from '../gamemode_management/index';
import {IDiscoveryResult} from '../gamemode_management/types/IDiscoveryResult';
import {setModEnabled} from '../profile_management/actions/profiles';
import {IProfileMod} from '../profile_management/types/IProfile';

import {showExternalChanges} from './actions/externalChanges';
import {addMod, removeMod, setModAttribute} from './actions/mods';
import {setActivator} from './actions/settings';
import {externalChangesReducer} from './reducers/externalChanges';
import {modsReducer} from './reducers/mods';
import {settingsReducer} from './reducers/settings';
import {IDeployedFile, IDeploymentMethod, IFileChange} from './types/IDeploymentMethod';
import {IFileEntry} from './types/IFileEntry';
import {IFileMerge} from './types/IFileMerge';
import {IInstruction} from './types/IInstallResult';
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
import resolvePath from './util/resolvePath';
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
import { generate as shortid } from 'shortid';

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
  const types = Object.keys(getGame(gameId)
    .getModPaths(gameDiscovery.path));

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
      (entry) => fs.copyAsync(
        path.join(outputPath, entry.filePath),
        path.join(sourcePath, entry.source, entry.filePath))))
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
  let lastActivatedState: { [modId: string]: IProfileMod };
  let lastGameDiscovery: IDiscoveryResult;

  return (api: IExtensionApi, manual: boolean, profileId?: string,
          progressCB?: (text: string, percent: number) => void): Promise<void> => {
    const progress = (text: string, percent: number) => {
      if (progressCB !== undefined) {
        progressCB(text, percent);
      }
    };
    const state = api.store.getState();
    let profile = profileId !== undefined
      ? getSafe(state, ['persistent', 'profiles', profileId], undefined)
      : activeProfile(state);
    if (profile === undefined) {
      return Promise.reject(new Error('Profile missing'));
    }
    const instPath = resolvePath('install', state.settings.mods.paths, profile.gameId);
    const gameDiscovery =
      getSafe(state, ['settings', 'gameMode', 'discovered', profile.gameId], undefined);
    const game = getGame(profile.gameId);
    if (game === undefined) {
      return Promise.reject(new Error('Game no longer available'));
    }
    const modPaths = game.getModPaths(gameDiscovery.path);
    const t = api.translate;
    let modState = profile !== undefined ? profile.modState : {};
    const activator = getActivator(state, profile.gameId);

    if (activator === undefined) {
      // this situation (no supported activator) should already be reported
      // elsewhere.
      return Promise.resolve();
    }

    lastGameDiscovery = gameDiscovery;

    const mods = state.persistent.mods[profile.gameId] || {};
    const modList: IMod[] = Object.keys(mods).map((key: string) => mods[key]);

    let notificationId: string;

    const gate = manual ? Promise.resolve() : activator.userGate();

    const lastDeployment: { [typeId: string]: IDeployedFile[] } = {};

    const fileMergers = mergers.reduce((prev: IResolvedMerger[], merge) => {
      const match = merge.test(game, gameDiscovery);
      if (match !== undefined) {
        prev.push({match, merge: merge.merge, modType: merge.modType});
      }
      return prev;
    }, []);

    // test if anything was changed by an external application
    return gate.then(() => {
        // update mod state again because if the user did have to
        // confirm, it's more intuitive
        // if we deploy the state at the time he confirmed, not when
        // the deployment was triggered
        profile = profileId !== undefined
          ? getSafe(state, ['persistent', 'profiles', profileId], undefined)
          : activeProfile(state);
        lastActivatedState = modState =
          profile !== undefined ? profile.modState : {};
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
      .then(() => {
        // for each mod type, check if the local files were changed outside vortex
        const changes: { [typeId: string]: IFileChange[] } = {};
        log('debug', 'determine external changes');
        progress('Checking for external changes', 5);
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
        progress('Sorting mods', 30);
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
      .then(() => sortMods(profile.gameId, modList, api))
      .then((sortedMods: string[]) => {
        const sortedModList = modList
          .filter(mod => getSafe(modState, [mod.id, 'enabled'], false))
          .sort((lhs: IMod, rhs: IMod) => sortedMods.indexOf(lhs.id) - sortedMods.indexOf(rhs.id));

        const mergedFileMap: { [modType: string]: string[] } = {};

        progress('Merging mods', 35);
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
            progress('Starting deployment', 35);
            const deployProgress =
              (name, percent) => progress(t('Deploying: ') + name, 50 + percent / 2);
            return Promise.each(Object.keys(modPaths),
                typeId => deployMods(api,
                                     game.id,
                                     instPath, modPaths[typeId],
                                     sortedModList.filter(mod => (mod.type || '') === typeId),
                                     activator, lastDeployment[typeId],
                                     typeId, new Set(mergedFileMap[typeId]),
                                     genSubDirFunc(game),
                                     deployProgress)
              .then(newActivation =>
                saveActivation(typeId, state.app.instanceId, modPaths[typeId], newActivation)));
          })
          .then(() => {
            progress('Preparing game settings', 100);
            return bakeSettings(api, profile.gameId, sortedModList);
          }));
      })
      .catch(UserCanceled, () => undefined)
      .catch(err => api.showErrorNotification('Failed to deploy mods', err))
      .finally(() => api.dismissNotification(notificationId));
  };
}

function genModsSourceAttribute(api: IExtensionApi): ITableAttribute {
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
    calc: (mod: IMod) => {
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
    const modPaths = game.getModPaths(currentGameDiscovery(state).path);

    const messages = activators.map((activator) => {
      const supported = allTypesSupported(activator, state, gameId, Object.keys(modPaths));
      return `[*] ${activator.name} - [i]${supported}[/i]`;
    });

    return resolve({
      description: {
        short: 'Mods can\'t be deployed.',
        long: 'With the current settings, mods can\'t be deployed.\n'
          + 'Please read the following error messages from the deployment '
          + 'plugins and fix one of them.\nAt least the "hard link deployment" '
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
  });
}

function cleanupIncompleteInstalls(api: IExtensionApi) {
  const store: Redux.Store<IState> = api.store;

  const { mods } = store.getState().persistent;
  const { paths } = store.getState().settings.mods;

  Object.keys(mods).forEach(gameId => {
    Object.keys(mods[gameId]).forEach(modId => {
      const mod = mods[gameId][modId];
      if (mod.state === 'installing') {
        const fullPath = path.join(resolvePath('install', paths, gameId), mod.installationPath);
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
        (gameId: string) => resolvePath(
            'install', store.getState().settings.mods.paths, gameId));
    installers.forEach((installer: IInstaller) => {
      installManager.addInstaller(installer.priority, installer.testSupported,
                                  installer.install);
    });
  }

  const updateModDeployment = genUpdateModDeployment();
  const deploymentTimer = new Debouncer(
      (manual: boolean, profileId, progressCB) => {
        blockDeploy = blockDeploy
          .then(() => updateModDeployment(api, manual, profileId, progressCB));
        return blockDeploy;
      }, 2000);

  api.events.on('deploy-mods', (callback: (err: Error) => void, profileId?: string,
                                progressCB?: (text: string, percent: number) => void) => {
    deploymentTimer.runNow(callback, true, profileId, progressCB);
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
    if (store.getState().settings.automation.deploy) {
      deploymentTimer.schedule(undefined, false);
    }
  });

  api.events.on('gamemode-activated',
      (newMode: string) => onGameModeActivated(api, activators, newMode));

  api.onStateChange(
      ['settings', 'mods', 'paths'],
      (previous, current) => onPathsChanged(api, previous, current));

  api.events.on('start-install', (archivePath: string,
                                  callback?: (error, id: string) => void) => {
    genHash(archivePath)
    .then(hashResult => {
      installManager.install(null, archivePath, activeGameId(store.getState()),
                             api, { download: { modInfo: { fileMD5: hashResult.md5sum } } },
                             true, false, callback);
      });
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
    LazyComponent('./views/ModList', __dirname), {
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

  context.registerSettings('Mods', LazyComponent('./views/Settings', __dirname),
                           () => ({activators}));

  context.registerDialog('external-changes',
                         LazyComponent('./views/ExternalChangeDialog', __dirname));

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

  registerInstaller('fallback', 1000, basicInstaller.testSupported, basicInstaller.install);

  context.once(() => once(context.api));

  return true;
}

export default init;
