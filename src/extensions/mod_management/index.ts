import {showDialog} from '../../actions/notifications';
import { setSettingsPage } from '../../actions/session';
import {IExtensionApi, IExtensionContext} from '../../types/IExtensionContext';
import {IState, IStatePaths} from '../../types/IState';
import { ITableAttribute, Placement } from '../../types/ITableAttribute';
import {ITestResult} from '../../types/ITestResult';
import { UserCanceled } from '../../util/CustomErrors';
import Debouncer from '../../util/Debouncer';
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
import {truthy} from '../../util/util';

import {IDownload} from '../download_management/types/IDownload';
import {getGames} from '../gamemode_management/index';
import {IDiscoveryResult} from '../gamemode_management/types/IDiscoveryResult';
import {setModEnabled} from '../profile_management/actions/profiles';
import {IProfileMod} from '../profile_management/types/IProfile';

import {showExternalChanges} from './actions/externalChanges';
import {addMod, removeMod, setModAttribute} from './actions/mods';
import {setActivator} from './actions/settings';
import {externalChangesReducer} from './reducers/externalChanges';
import {modsReducer} from './reducers/mods';
import {settingsReducer} from './reducers/settings';
import {IFileEntry} from './types/IFileEntry';
import {IInstall} from './types/IInstall';
import {IMod} from './types/IMod';
import {
  IDeployedFile,
  IFileChange,
  IModActivator,
} from './types/IModActivator';
import {IModSource} from './types/IModSource';
import {ITestSupported} from './types/ITestSupported';
import { loadActivation, saveActivation } from './util/activationStore';
import * as basicInstaller from './util/basicInstaller';
import { registerAttributeExtractor } from './util/filterModInfo';
import resolvePath from './util/resolvePath';
import sortMods from './util/sort';
import supportedActivators from './util/supportedActivators';
import ActivationButton from './views/ActivationButton';
import DeactivationButton from './views/DeactivationButton';
import {} from './views/ExternalChangeDialog';
import {} from './views/ModList';
import {} from './views/Settings';

import { onGameModeActivated, onPathsChanged,
         onRemoveMod, onStartInstallDownload } from './eventHandlers';
import InstallManager from './InstallManager';
import { activateMods } from './modActivation';
import getText from './texts';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import * as Redux from 'redux';
import { generate as shortid } from 'shortid';

const activators: IModActivator[] = [];

let installManager: InstallManager;

interface IInstaller {
  priority: number;
  testSupported: ITestSupported;
  install: IInstall;
}

const installers: IInstaller[] = [];

const modSources: IModSource[] = [];

export interface IExtensionContextExt extends IExtensionContext {
  registerModActivator: (activator: IModActivator) => void;
  registerInstaller: (priority: number, testSupported: ITestSupported, install: IInstall) => void;
}

function registerModActivator(activator: IModActivator) {
  activators.push(activator);
}

function registerInstaller(priority: number, testSupported: ITestSupported, install: IInstall) {
  installers.push({ priority, testSupported, install });
}

function registerModSource(id: string, name: string, onBrowse: () => void) {
  modSources.push({ id, name, onBrowse });
}

function getActivator(state: IState): IModActivator {
  const activatorId = currentActivator(state);
  let activator: IModActivator;
  if (activatorId !== undefined) {
    activator = activators.find((act: IModActivator) => act.id === activatorId);
  }
  if (activator === undefined) {
    activator = activators.find((act: IModActivator) => act.isSupported(state) === undefined);
  }
  return activator;
}

function purgeMods(api: IExtensionApi): Promise<void> {
  const state = api.store.getState();
  const instPath = installPath(state);
  const gameDiscovery = currentGameDiscovery(state);
  const t = api.translate;
  const activator = getActivator(state);

  if (activator === undefined) {
    return Promise.reject(new Error('can\t purge without deployment method selected'));
  }

  const notificationId = api.sendNotification({
    type: 'activity',
    message: t('Purging mods'),
    title: t('Purging'),
  });

  return loadActivation(api, gameDiscovery.modPath)
      .then(() => activator.purge(instPath, gameDiscovery.modPath))
      .then(() => saveActivation(state.app.instanceId, gameDiscovery.modPath, []))
      .catch(UserCanceled, () => undefined)
      .catch(err => api.showErrorNotification('failed to purge mods', err))
      .finally(() => api.dismissNotification(notificationId));
}

function applyFileActions(gameDiscovery: IDiscoveryResult,
                          instPath: string,
                          lastActivation: IDeployedFile[],
                          fileActions: IFileEntry[]) {
  if (fileActions === undefined) {
    return Promise.resolve();
  }

  const actionGroups: { [type: string]: IFileEntry[] } = {};
  fileActions.forEach((action: IFileEntry) => {
    if (actionGroups[action.action] === undefined) {
      actionGroups[action.action] = [];
    }
    actionGroups[action.action].push(action);
  });

  // process the actions that the user selected in the dialog
  return Promise.map(actionGroups['drop'] || [],
    // delete the files the user wants to drop
    (entry) => truthy(entry.filePath)
      ? fs.removeAsync(path.join(gameDiscovery.modPath, entry.filePath))
      : Promise.reject(new Error('invalid file path')))
    .then(() => Promise.map(
      actionGroups['import'] || [],
      // copy the files the user wants to import
      (entry) => fs.copyAsync(
        path.join(gameDiscovery.modPath, entry.filePath),
        path.join(instPath, entry.source, entry.filePath))))
    .then(() => {
      // remove files that the user wants to restore from
      // the activation list because then they get reinstalled
      if (actionGroups['restore'] !== undefined) {
        const restoreSet = new Set(actionGroups['restore'].map(entry => entry.filePath));
        const newActivation = lastActivation.filter(entry =>
          !restoreSet.has(entry.relPath));
        lastActivation = newActivation;
      } else {
        return Promise.resolve();
      }
    })
    .then(() => undefined);
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

function genUpdateModActivation() {
  let lastActivatedState: { [modId: string]: IProfileMod };
  let lastGameDiscovery: IDiscoveryResult;

  return (api: IExtensionApi, manual: boolean): Promise<void> => {
    const state = api.store.getState();
    const gameMode = activeGameId(state);
    const instPath = installPath(state);
    const gameDiscovery = currentGameDiscovery(state);
    const t = api.translate;
    let profile = activeProfile(state);
    let modState = profile !== undefined ? profile.modState : {};
    const activator = getActivator(state);

    if (activator === undefined) {
      // this situation (no supported activator) should already be reported
      // elsewhere
      return Promise.resolve();
    }

    if ((modState === lastActivatedState) &&
      (gameDiscovery === lastGameDiscovery)) {
      // early out if nothing relevant to the deployment has changed
      api.sendNotification({
        type: 'info',
        message: t('No changes to deploy'),
        displayMS: 3000,
      });
      return Promise.resolve();
    }

    lastGameDiscovery = gameDiscovery;

    const mods = state.persistent.mods[gameMode] || {};
    const modList: IMod[] = Object.keys(mods).map((key: string) => mods[key]);

    let notificationId: string;

    const gate = manual ? Promise.resolve() : activator.userGate();

    let lastDeployment: IDeployedFile[] = [];

    // test if anything was changed by an external application
    return gate.then(() => {
      // update mod state again because if the user did have to
      // confirm, it's more intuitive
      // if we deploy the state at the time he confirmed, not when
      // the deployment was triggered
      profile = activeProfile(api.store.getState());
      lastActivatedState = modState =
        profile !== undefined ? profile.modState : {};
      notificationId = api.sendNotification({
        type: 'activity',
        message: t('Deploying mods'),
        title: t('Deploying'),
      });

      return loadActivation(api, gameDiscovery.modPath);
    })
      .then(currentActivation => {
        lastDeployment = currentActivation;
        return activator.externalChanges(instPath, gameDiscovery.modPath, currentActivation);
      })
      .then((changes: IFileChange[]) =>
        (changes.length === 0)
          ? Promise.resolve([])
          : api.store.dispatch(showExternalChanges(changes)))
      .then(fileActions => applyFileActions(gameDiscovery, instPath, lastDeployment, fileActions))
      // sort (all) mods based on their dependencies so the right files get
      // activated
      .then(() => sortMods(gameMode, modList, api))
      .then((sortedMods: string[]) => {
        const sortedModList = modList
          .filter(mod => getSafe(modState, [mod.id, 'enabled'], false))
          .sort((lhs: IMod, rhs: IMod) =>
            sortedMods.indexOf(lhs.id) -
            sortedMods.indexOf(rhs.id));

        return activateMods(api, getGames().find(iter => iter.id === gameMode),
                            instPath, gameDiscovery.modPath, sortedModList,
                            activator, lastDeployment)
            .then(newActivation =>
                      saveActivation(state.app.instanceId,
                                     gameDiscovery.modPath, newActivation))
            .then(() => bakeSettings(api, gameMode, sortedModList));
      })
      .catch(UserCanceled, () => undefined)
      .catch(err => api.showErrorNotification('failed to deploy mods', err))
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
      onChangeValue: (rowIds: string[], newValue: string) => {
        const store = api.store;
        const gameMode = activeGameId(store.getState());
        rowIds.forEach(rowId => store.dispatch(setModAttribute(
                           gameMode, rowId, 'source', newValue)));
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

    const messages = activators.map(
      (activator) => `[*] ${activator.name} - [i]${activator.isSupported(state)}[/i]`);

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
        api.events.emit('show-main-page', 'Settings');
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
    source: getSafe(input, ['source'], undefined),
    fileName: getSafe(input.meta, ['fileName'], undefined),
    fileMD5: getSafe(input.meta, ['fileMD5'], undefined),
    fileSize: getSafe(input.meta, ['fileSize'], undefined),
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

  const updateModActivation = genUpdateModActivation();
  const activationTimer = new Debouncer(
      (manual: boolean) => updateModActivation(api, manual), 2000);

  api.events.on('activate-mods', (callback: (err: Error) => void) => {
    activationTimer.runNow(callback, true);
  });

  api.events.on('schedule-activate-mods', (callback: (err: Error) => void) => {
    activationTimer.schedule(callback, false);
  });

  api.events.on('purge-mods',
                (callback: (err: Error) => void) => { purgeMods(api); });

  api.events.on('await-activation', (callback: (err: Error) => void) => {
    activationTimer.wait(callback);
  });

  api.events.on('mods-enabled', (mods: string[], enabled: boolean) => {
    if (store.getState().settings.automation.deploy) {
      activationTimer.schedule(undefined, false);
    }
  });

  api.events.on('gamemode-activated', (newMode: string) => onGameModeActivated(
                                          api, activators, newMode));

  api.onStateChange(
      ['settings', 'mods', 'paths'],
      (previous, current) => onPathsChanged(api, previous, current));

  api.events.on('start-install', (archivePath: string,
                                  callback?: (error, id: string) => void) => {
    installManager.install(null, archivePath, activeGameId(store.getState()),
                           api, {}, true, false, callback);
  });

  api.events.on(
      'start-install-download',
      (downloadId: string, callback?: (error, id: string) => void) =>
          onStartInstallDownload(api, installManager, downloadId, callback));

  api.events.on(
      'remove-mod',
      (gameMode: string, modId: string, callback?: (error: Error) => void) =>
          onRemoveMod(api, activators, gameMode, modId, callback));

  cleanupIncompleteInstalls(api);

}

function init(context: IExtensionContextExt): boolean {
  const modsActivity = new ReduxProp(context.api, [
    ['session', 'base', 'activity', 'mods'],
  ], (activity: string[]) => (activity !== undefined) && (activity.length > 0));

  context.registerMainPage('wrench', 'Mods',
    LazyComponent('./views/ModList', __dirname), {
    hotkey: 'M',
    group: 'per-game',
    visible: () => activeGameId(context.api.store.getState()) !== undefined,
    activity: modsActivity,
    props: () => ({ modSources }),
  });

  context.registerAction('mod-icons', 105, ActivationButton, () => {
    return {
      key: 'activate-button',
      activators,
    };
  });

  context.registerAction('mod-icons', 110, DeactivationButton, () => {
    return {
      key: 'deactivate-button',
      activators,
    };
  });

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

  context.registerModActivator = registerModActivator;
  context.registerInstaller = registerInstaller;
  context.registerAttributeExtractor = registerAttributeExtractor;
  context.registerModSource = registerModSource;

  registerAttributeExtractor(100, attributeExtractor);

  registerInstaller(1000, basicInstaller.testSupported, basicInstaller.install);

  context.once(() => once(context.api));

  return true;
}

export default init;
