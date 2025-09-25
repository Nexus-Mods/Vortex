/* eslint-disable */
import {IExtensionApi, IExtensionContext} from '../../types/IExtensionContext';
import { NotificationDismiss } from '../../types/INotification';
import { IExtensionLoadFailure, IState } from '../../types/IState';
import { relaunch } from '../../util/commandLine';
import { DataInvalid, ProcessCanceled } from '../../util/CustomErrors';
import { isExtSame } from '../../util/ExtensionManager';
import { log } from '../../util/log';
import makeReactive from '../../util/makeReactive';

import { setAvailableExtensions, setExtensionsUpdate, setInstalledExtensions } from './actions';
import BrowseExtensions from './BrowseExtensions';
import ExtensionManager from './ExtensionManager';
import sessionReducer from './reducers';
import { IAvailableExtension, IExtension, IExtensionDownloadInfo } from './types';
import { downloadAndInstallExtension, fetchAvailableExtensions, readExtensions, readExtensionsSync } from './util';

import Promise from 'bluebird';
import * as _ from 'lodash';
import * as path from 'path';
import * as semver from 'semver';
import { setDialogVisible, setExtensionEnabled } from '../../actions';
import { getGame } from '../../util/api';

interface ILocalState {
  reloadNecessary: boolean;
  preselectModId: number;
}

const localState: ILocalState = makeReactive({
  reloadNecessary: false,
  preselectModId: undefined,
});

function checkForUpdates(api: IExtensionApi) {
  const state: IState = api.store.getState();
  const { available, installed }  = state.session.extensions;

  const updateable: Array<{ update: IAvailableExtension, current: IExtension}> =
    Object.values(installed).reduce((prev, ext) => {
      const update = available.find(iter => isExtSame(ext, iter));

      if ((update === undefined)
          || (update.version === undefined)) {
        // as of Vortex 1.8 we expect to find all extension, including the bundled ones, in the
        // list of available extensions
        if (ext.modId !== undefined) {
          log('warn', '⚠️ extension not available', { ext: JSON.stringify(ext) });
        }
        return prev;
      }

      const extVer = semver.coerce(ext.version);
      const updateVer = semver.coerce(update.version);

      if ((extVer === null) || (updateVer === null)) {
        log('warn', '⚠️ invalid version on extension', { local: ext.version, update: update.version });
        return prev;
      }

      if (semver.gte(extVer, updateVer)) {
        return prev;
      }

      prev.push({ current: ext, update });

      return prev;
    }, []);
  
  let forceRestart: boolean = false;

  {
    const state = api.getState();
    const { commandLine } = state.session.base;
    if (commandLine.installExtension !== undefined) {
      const request = parseInstallCmdLine(commandLine.installExtension);
      const update = available.find(ext =>
        (request.modId !== undefined) && (ext.modId === request.modId));

      if (update !== undefined) {
        // Only force restart for non-game extensions
        if (update.type !== 'game') {
          forceRestart = true;
        }
        updateable.push({
          current: {
            author: update.author,
            description: update.description.short,
            name: update.name,
            version: '',
          }, update
        });
      }
    }
  }

  if (updateable.length === 0) {
    return Promise.resolve();
  }

  api.sendNotification({
    id: 'extension-updates',
    type: 'info',
    message: '{{ count }} extensions will be updated',
    replace: { count: updateable.length },
  });

  log('info', '🔄 extensions can be updated', {
    updateable: updateable.map(ext => `${ext.current.name} v${ext.current.version} `
                                  + `-> ${ext.update.name} v${ext.update.version}`) });

  return Promise.map(updateable, update => downloadAndInstallExtension(api, update.update))
    .then((success: boolean[]) => {
      api.dismissNotification('extension-updates');
      
      // Check if any non-game extensions were updated
      const nonGameUpdates = updateable.filter(update => update.update.type !== 'game');
      const gameUpdates = updateable.filter(update => update.update.type === 'game');
      
      if (success.find(iter => iter === true)) {
        if (forceRestart) {
          relaunch();
        } else {
          // Show success notification for all extensions without restart requirement
          const totalUpdates = nonGameUpdates.length + gameUpdates.length;
          api.sendNotification({
            id: 'extension-updates',
            type: 'success',
            message: `Extension(s) updated successfully (${totalUpdates} extension${totalUpdates > 1 ? 's' : ''}).`,
            displayMS: 5000,
          });
          
          // Don't emit refresh-game-list here to prevent infinite loop
          // The refresh will be handled by the caller if needed
        }
      }
    });
}

function updateAvailableExtensions(api: IExtensionApi, force: boolean = false) {
  const state: IState = api.store.getState();
  if (!state.session.base.networkConnected) {
    return Promise.resolve();
  }
  return fetchAvailableExtensions(true, force)
    .catch(DataInvalid, err => {
      api.showErrorNotification('Failed to fetch available extensions', err,
                                { allowReport: false });
      return { time: null, extensions: [] };
    })
    .catch(err => {
      api.showErrorNotification('Failed to fetch available extensions', err);
      return { time: null, extensions: [] };
    })
    .then(({ time, extensions }: { time: Date, extensions: IAvailableExtension[] }) => {
      if (time !== null) {
        api.store.dispatch(setExtensionsUpdate(time.getTime()));
        api.store.dispatch(setAvailableExtensions(extensions));
        return checkForUpdates(api);
      } else {
        return Promise.resolve();
      }
    });
}

function installDependency(api: IExtensionApi,
                           depId: string,
                           updateInstalled: (initial: boolean) => Promise<void>): Promise<boolean> {
  const state: IState = api.store.getState();
  const availableExtensions = state.session.extensions.available;
  const installedExtensions = state.session.extensions.installed;

  if (installedExtensions[depId] !== undefined) {
    // installed, probably failed to load or disabled
    if (!state.app.extensions[depId].enabled) {
      api.store.dispatch(setExtensionEnabled(depId, true));
      return Promise.resolve(true);
    } else {
      api.showErrorNotification(
        'Failed to install extension',
        'The extension "{{ name }}" is already installed but failed to load, '
        + 'please review the load error on the "Extensions" tab.', {
          message: depId,
          allowReport: false,
          replace: { name: depId },
        });

      return Promise.resolve(false);
    }
  }

  const ext = availableExtensions.find(iter =>
    (!iter.type && ((iter.name === depId) || (iter.id === depId))));
  if (ext !== undefined) {
    return downloadAndInstallExtension(api, ext)
      .then(success => {
        if (success) {
          updateInstalled(false);
        } else {
          api.showErrorNotification(
            'Failed to install extension',
            'The extension "{{ name }}" wasn\'t found in the repository. '
            + 'This might mean that the extension isn\'t available at all or '
            + 'has been excluded for compatibility reasons. '
            + 'Please check the installation instructions for this extension.', {
              message: depId,
              allowReport: false,
              replace: { name: depId },
            });
        }
        return success;
      });
  } else {
    return Promise.resolve(false);
  }
}

function checkMissingDependencies(api: IExtensionApi,
                                  loadFailures: { [extId: string]: IExtensionLoadFailure[] }) {
    const missingDependencies = Object.keys(loadFailures)
      .reduce((prev, extId) => {
        const deps = loadFailures[extId].filter(fail => fail.id === 'dependency');
        deps.forEach(dep => {
          const depId = dep.args.dependencyId;
          if (prev[depId] === undefined) {
            prev[depId] = [];
          }
          prev[depId].push(extId);
        });
        return prev;
      }, {});

    // Filter out dependencies that are not installable on this platform (excluded submodules):
    // If a dependency is neither installed nor present in the available extensions list,
    // then we can't fix it programmatically, so suppress the "Fix" notification for it.
    const state: IState = api.store.getState();
    const availableExtensions = state.session.extensions.available;
    const installedExtensions = state.session.extensions.installed;

    const installableMissing = Object.keys(missingDependencies).reduce((acc, depId) => {
      const isInstalled = installedExtensions[depId] !== undefined;
      const isAvailable = availableExtensions.find(iter => (!iter.type && ((iter.name === depId) || (iter.id === depId)))) !== undefined;
      if (isInstalled || isAvailable) {
        acc[depId] = missingDependencies[depId];
      }
      return acc;
    }, {} as { [depId: string]: string[] });

    if (Object.keys(installableMissing).length > 0) {
      const updateInstalled = genUpdateInstalledExtensions(api);
      api.sendNotification({
        type: 'warning',
        message: 'Some of the installed extensions couldn\'t be loaded because '
               + 'they have missing or incompatible dependencies.',
        actions: [
          { title: 'Fix', action: (dismiss: NotificationDismiss) => {
            Promise.map(Object.keys(installableMissing), depId =>
              installDependency(api, depId, updateInstalled)
                .then(results => {
                  if (results) {
                    api.sendNotification({
                      type: 'success',
                      message: 'Missing dependencies were installed - please restart Vortex',
                      actions: [
                        {
                          title: 'Restart now', action: () => {
                            relaunch();
                          },
                        },
                      ],
                    });
                    dismiss();
                  }
                })
                .catch(err => {
                  api.showErrorNotification('Failed to install extension', err, {
                    message: depId,
                  });
                }));
          } },
        ],
      });
    }
}

function genUpdateInstalledExtensions(api: IExtensionApi) {
  return (initial: boolean): Promise<void> => {
    return readExtensions(true)
      .then(ext => {
        const state: IState = api.store.getState();
        if (!initial && !_.isEqual(state.session.extensions.installed, ext)) {
          // Check if only game extensions were added
          const previousExtensions = state.session.extensions.installed || {};
          const newExtensions = Object.keys(ext).filter(extId => !previousExtensions[extId]);
          const newGameExtensions = newExtensions.filter(extId => ext[extId].type === 'game');
          const newNonGameExtensions = newExtensions.filter(extId => ext[extId].type !== 'game');
          
          // Show success notification for all installed extensions without restart requirement
          if (newExtensions.length > 0) {
            // Create a more specific message based on the types of extensions installed
            let message = `Extension(s) installed successfully (${newExtensions.length} extension${newExtensions.length > 1 ? 's' : ''}).`;
            if (newGameExtensions.length > 0 && newNonGameExtensions.length === 0) {
              message += ' Game extensions are available immediately.';
            } else if (newGameExtensions.length > 0) {
              message += ` ${newGameExtensions.length} game extension(s) are available immediately.`;
            }
            
            api.sendNotification({
              id: 'extension-installed',
              type: 'success',
              message: message,
              displayMS: 5000,
            });
            
            // Don't emit refresh-game-list here to prevent infinite loop
            // The refresh will be handled by the caller if needed
          }
        }
        api.store.dispatch(setInstalledExtensions(ext));
      })
      .catch(err => {
        // this probably only occurs if the user deletes the plugins directory after start
        api.showErrorNotification('Failed to read extension directory', err, {
          allowReport: false,
        });
      });
  };
}

function parseInstallCmdLine(argument: string): IExtensionDownloadInfo {
  const modIdMatch = argument.match(/modId:(\d+)/);
  if (modIdMatch != null) {
    return {
      name: 'Commandline Request',
      modId: parseInt(modIdMatch[1], 10),
    };
  } else {
    throw new Error(`invalid command line argument "${argument}"`);
  }
}

function init(context: IExtensionContext) {
  const updateExtensions = genUpdateInstalledExtensions(context.api);
  context.registerReducer(['session', 'extensions'], sessionReducer);

  context.registerMainPage('extensions', 'Extensions', ExtensionManager, {
    hotkey: 'X',
    group: 'global',
    // visible: () => context.api.store.getState().settings.interface.advanced,
    props: () => ({
      localState,
      updateExtensions,
    }),
  });

  const forceUpdateExtensions = () => {
    updateAvailableExtensions(context.api, true);
  };

  context.registerAction('extensions-layout-icons', 500, 'refresh', {}, 'Update Extensions', () => {
    forceUpdateExtensions();
  });

  context.registerDialog('browse-extensions', BrowseExtensions, () => ({
    localState,
    updateExtensions,
    onRefreshExtensions: forceUpdateExtensions,
  }));

  context.registerActionCheck('SET_EXTENSION_ENABLED', (state, action: any) => {
    if (process.type === 'browser') {
      log('info', '🔧 changing extension enabled', action.payload);
    }
    return undefined;
  });

  context.registerInstaller('site-installer', 0,
    (files: string[], gameId: string) => Promise.resolve({
      supported: gameId === 'site',
      requiredFiles: [],
    }),
    () => {
      return Promise.reject(
        new ProcessCanceled('Extensions have to be installed from the extensions page.'));
    });

  context.once(() => {
    // Expose the updateExtensions function so it can be called from other modules
    // This must be done in the once callback where the API is available
    context.api.ext['updateExtensions'] = updateExtensions;
    
    let onDidFetch: () => void;
    const didFetchAvailableExtensions = new Promise((resolve => onDidFetch = resolve));
    updateExtensions(true)
    .then(() => updateAvailableExtensions(context.api))
    .then(() => onDidFetch())
    .catch(err => {
      // If extension fetching fails, still resolve the promise to avoid blocking install-extension
      log('error', '❌ Failed to fetch available extensions', err);
      onDidFetch();
    });
    context.api.onAsync('install-extension', (ext: IExtensionDownloadInfo) => {
      return didFetchAvailableExtensions
        .then(() => downloadAndInstallExtension(context.api, ext))
        .then(success => {
          if (success) {
            // Immediately update extension list synchronously for instant UI feedback
            try {
              const extensionsPath = context.api.getPath('bundledPlugins');
              const userDataPath = context.api.getPath('userData');
              const userExtensionsPath = path.join(userDataPath, 'plugins');
              
              const extensions = readExtensionsSync(true);
              context.api.store.dispatch(setInstalledExtensions(extensions));
              
              log('info', 'Extension list updated synchronously in event handler', { 
                extensionCount: Object.keys(extensions).length 
              });
            } catch (err) {
              log('warn', 'Failed to update extension list synchronously in event handler', { error: err.message });
            }
            
            return updateExtensions(false)
              .then(() => {
                // Check if any of the newly installed extensions are game extensions
                // If so, emit refresh-game-list to update the UI
                const state = context.api.getState();
                const previousExtensions = state.session.extensions.installed || {};
                const newExtensions = Object.keys(state.session.extensions.installed)
                  .filter(extId => !previousExtensions[extId]);
                const newGameExtensions = newExtensions
                  .filter(extId => state.session.extensions.installed[extId].type === 'game');
                          
                if (newGameExtensions.length > 0) {
                  // Emit refresh-game-list with forceFullDiscovery=true to ensure game extensions are properly registered
                  context.api.events.emit('refresh-game-list', true);
                }
                        
                return success;
              });
          } else {
            return Promise.resolve()
              .then(() => success);
          }
        });
      });

    context.api.events.on('gamemode-activated', (gameMode: string) => {
      const state = context.api.getState();
      const game = getGame(gameMode);
      const gameExtId = Object.keys(state.session.extensions.installed).find(key =>
        game.extensionPath === state.session.extensions.installed[key].path);
      if (!gameExtId || !state.session.extensions.optional[gameExtId]) {
        return;
      }
      const requiredIds = [];
      for (const ext of state.session.extensions.optional[gameExtId]) {
        if (!state.session.extensions.installed[ext.id]) {
          requiredIds.push(ext.id);
        }
      }

      if (requiredIds.length > 0) {
        const t = context.api.translate;
        context.api.sendNotification({
          id: `missing-optional-extensions-${gameExtId}`,
          type: 'warning',
          message: 'Missing Optional Extension/s',
          allowSuppress: true,
          actions: [{
            title: 'More', action: (dismiss) => {
              context.api.showDialog('question', 'Missing Optional Extension/s', {
                bbcode: t('Some optional extensions for "{{game}}" are missing.[br][/br][br][/br]'
                      + 'Do you want to install them now?', { replace: { game: game.name } }),
                message: `Missing extensions:\n\n${requiredIds.map(id => `- ${id}\n`).join('')}`,
              }, [
                { label: 'Cancel', action: () => dismiss() },
                { label: 'Install', action: async () => {
                  dismiss();
                  for (const id of requiredIds) {
                    await installDependency(context.api, id, updateExtensions);
                  }    
                }}
              ])
            }
          }, {
            title: 'Install Extension/s', action: async () => {
              for (const id of requiredIds) {
                await installDependency(context.api, id, updateExtensions);
              }
          }}]
        });
      }
    });
    context.api.onAsync('install-extension-from-download', (archiveId: string) => {
      const state = context.api.getState();
      const modId = state.persistent.downloads.files[archiveId]?.modInfo?.nexus?.ids?.modId;
      const ext = state.session.extensions.available.find(iter => iter.modId === modId);
      const isInstalled = Object.values(state.session.extensions.installed).find(inst =>
        (!!inst?.modId) // Corrupt state ? (#9935)
          && (inst.modId === ext?.modId)
          && (inst.version === ext?.version)) !== undefined;
      if (isInstalled) {
        context.api.sendNotification({
          id: 'extension-already-installed',
          type: 'info',
          message: 'Vortex extension is already installed',
        });
        return Promise.resolve();
      }

      if ((modId !== undefined) && (ext !== undefined)) {
        return downloadAndInstallExtension(context.api, ext)
          .tap(success => {
            if (success) {
              updateExtensions(false);
            }
          });
      } else {
        context.api.sendNotification({
          id: 'not-an-extension',
          type: 'warning',
          title: 'Archive not recognized as a Vortex extension.',
          message: 'If this is a new extension it may not have been approved yet.',
        });
        return Promise.resolve();
      }
    });

    context.api.events.on('show-extension-page', (modId: number) => {
      localState.preselectModId = modId;
      context.api.store.dispatch(setDialogVisible('browse-extensions'));
    });

    context.api.onStateChange(['session', 'base', 'extLoadFailures'], (prev, current) => {
      checkMissingDependencies(context.api, current);
    });

    {
      const state: IState = context.api.store.getState();
      checkMissingDependencies(context.api, state.session.base.extLoadFailures);
    }
  });

  return true;
}

export default init;
