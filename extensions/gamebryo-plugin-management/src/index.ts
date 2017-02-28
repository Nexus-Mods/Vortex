import {updateLoadOrder} from './actions/loadOrder';
import {setPluginList} from './actions/plugins';
import {loadOrderReducer} from './reducers/loadOrder';
import {pluginsReducer} from './reducers/plugins';
import {settingsReducer} from './reducers/settings';
import {ILoadOrder} from './types/ILoadOrder';
import {IPlugins} from './types/IPlugins';
import PluginList from './views/PluginList';

import LootInterface from './autosort';

import {
  gameSupported,
  isNativePlugin,
  nativePlugins,
  pluginPath,
  supportedGames,
} from './util/gameSupport';
import PluginPersistor from './util/PluginPersistor';

import * as Promise from 'bluebird';
import { remote } from 'electron';
import ESPFile from 'esptk';
import {access, constants} from 'fs';
import * as fs from 'fs-extra-promise';
import { log, selectors, types, util } from 'nmm-api';
import * as path from 'path';
import * as nodeUtil from 'util';

interface IModState {
  enabled: boolean;
}

type IModStates = { [modId: string]: IModState };

function isPlugin(fileName: string): boolean {
  return ['.esp', '.esm'].indexOf(path.extname(fileName).toLowerCase()) !== -1;
}

/**
 * updates the list of known plugins for the managed game
 */
function updatePluginList(store: Redux.Store<any>, newModList: IModStates): Promise<void> {
  if (newModList === undefined) {
    return;
  }

  const state = store.getState();

  const gameMode = selectors.activeGameId(state);
  let pluginSources: { [pluginName: string]: string } = {};

  const currentDiscovery = selectors.currentGameDiscovery(state);
  let readErrors = [];

  const gameMods = state.persistent.mods[gameMode] || {};

  return Promise.map(Object.keys(gameMods), (modId: string) => {
    let mod = gameMods[modId];
    return fs.readdirAsync(path.join(selectors.installPath(state), mod.installationPath))
    .then((fileNames: string[]) => {
      fileNames
      .filter((fileName: string) => ['.esp', '.esm'].indexOf(path.extname(fileName)) !== -1)
      .forEach((fileName: string) => {
        pluginSources[fileName] = mod.name || mod.id;
      });
    })
    .catch((err: Error) => {
      readErrors.push(mod.id);
      log('warn', 'failed to read mod directory',
        { path: mod.installationPath, error: err.message });
    });
  })
  .then(() => {
    if (readErrors.length > 0) {
      util.showError(
        store.dispatch,
        'Failed to read some mods',
        'The following mods could not be searched (see log for details):\n' +
          readErrors.join('\n')
        );
    }
    if (currentDiscovery === undefined) {
      return Promise.resolve([]);
    }
    let modPath = currentDiscovery.modPath;
    return fs.readdirAsync(modPath);
  })
  .then((fileNames: string[]) => {
    let pluginNames: string[] = fileNames.filter(isPlugin);
    let pluginStates: IPlugins = {};
    pluginNames.forEach((fileName: string) => {
      let modName = pluginSources[fileName];
      pluginStates[fileName] = {
        modName: modName || '',
        filePath: path.join(currentDiscovery.modPath, fileName),
        isNative: modName === undefined && isNativePlugin(gameMode, fileName),
      };
    });
    store.dispatch(setPluginList(pluginStates));
    store.dispatch(updateLoadOrder(pluginNames));
    return Promise.resolve();
  })
  .catch((err: Error) => {
    util.showError(store.dispatch, 'Failed to update plugin list', err);
  })
  ;
}

interface IExtensionContextExt extends types.IExtensionContext {
  registerProfileFile: (gameId: string, filePath: string) => void;
}

let persistor: PluginPersistor;
let loot: LootInterface;
let refreshTimer: NodeJS.Timer;

function register(context: IExtensionContextExt) {
  context.registerMainPage('puzzle-piece', 'Plugins', PluginList, {
    hotkey: 'E',
    visible: () => gameSupported(selectors.activeGameId(context.api.store.getState())),
    props: () => ({
      nativePlugins: nativePlugins(selectors.activeGameId(context.api.store.getState())),
    }),
  });

  for (let game of supportedGames()) {
    context.registerProfileFile(game, path.join(pluginPath(game), 'plugins.txt'));
    context.registerProfileFile(game, path.join(pluginPath(game), 'loadorder.txt'));
  }

  context.registerStyle(path.join(__dirname, 'plugin_management.scss'));

  context.registerReducer(['session', 'plugins'], pluginsReducer);
  context.registerReducer(['loadOrder'], loadOrderReducer);
  context.registerReducer(['settings', 'plugins'], settingsReducer);
}

/**
 * initialize persistor, exposing the content of plugins.txt / loadorder.txt to
 * the store
 */
function initPersistor(context: IExtensionContextExt) {
  // TODO: Currently need to stop this from being called in the main process.
  //   This is mega-ugly and needs to go
  if ((persistor === undefined) && (remote !== undefined)) {
    persistor = new PluginPersistor();
  }
  if (persistor !== undefined) {
    context.registerPersistor('loadOrder', persistor);
  }
}

/**
 * update the plugin list for the currently active profile
 */
function updateCurrentProfile(store: Redux.Store<any>): Promise<void> {
  const gameId = selectors.activeGameId(store.getState());

  if (!gameSupported(gameId)) {
    return;
  }

  const profile = selectors.activeProfile(store.getState());
  if (profile === undefined) {
    log('warn', 'no profile active');
    return;
  }

  return updatePluginList(store, profile.modState);
}

let watcher: fs.FSWatcher;

function stopSync() {
  if (watcher !== undefined) {
    watcher.close();
    watcher = undefined;
  }

  persistor.stopSync();
}

function startSync(api: types.IExtensionApi) {
  const store = api.store;

  if (persistor !== undefined) {
    persistor.loadFiles(selectors.activeGameId(store.getState()));
  }

  const modPath = selectors.currentGameDiscovery(store.getState()).modPath;
  if (modPath === undefined) {
    // can this even happen?
    log('error', 'mod path unknown',
      { discovery: nodeUtil.inspect(selectors.currentGameDiscovery(store.getState())) });
    return;
  }
  // watch the mod directory. if files change, that may mean our plugin list
  // changed, so refresh
  watcher = fs.watch(modPath, {}, (evt: string, fileName: string) => {
    if (refreshTimer !== undefined) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
      updateCurrentProfile(store)
          .then(() => { api.events.emit('autosort-plugins'); });
      refreshTimer = undefined;
    }, 500);
  });
}

function testPluginsLocked(gameMode: string): Promise<types.ITestResult> {
  if (!gameSupported(gameMode)) {
    return Promise.resolve(undefined);
  }

  const filePath = path.join(pluginPath(gameMode), 'plugins.txt');
  return new Promise<types.ITestResult>((resolve, reject) => {
    access(filePath, constants.W_OK, (err) => {
      if (err === null) {
        resolve(undefined);
      } else {
        let res: types.ITestResult = {
          description: {
            short: 'plugins.txt is write protected',
            long: 'This file is used to control which plugins the game uses and while it\'s '
                  + 'write protected NMM2 will not be able to enable or disable plugins.\n'
                  + 'If you click "fix" the file will be marked writable.',
          },
          severity: 'error',
          automaticFix: () =>
            fs.chmodAsync(filePath, parseInt('0777', 8)),
        };

        resolve(res);
      }
    });
  });
}

function testMissingMasters(state: any): Promise<types.ITestResult> {
  const gameMode = selectors.activeGameId(state);
  if (!gameSupported(gameMode)) {
    return Promise.resolve(undefined);
  }

  const pluginList = state.session.plugins.pluginList;

  const loadOrder: {[plugin: string]: ILoadOrder} = state.loadOrder;
  const enabledPlugins = Object.keys(loadOrder).filter(
      (plugin: string) => loadOrder[plugin].enabled);
  const pluginDetails =
      enabledPlugins.filter((name: string) => pluginList[name] !== undefined)
          .map((plugin) => ({
                 name: plugin,
                 detail: new ESPFile(pluginList[plugin].filePath),
               }));
  const masters = new Set<string>([].concat(pluginDetails
    .filter((plugin) => plugin.detail.isMaster)
    .map((plugin) => plugin.name),
    nativePlugins(gameMode)
    ).map((name) => name.toLowerCase()));

  let broken = pluginDetails.filter((plugin) => {
    let missing = plugin.detail.masterList.filter(
        (requiredMaster) => !masters.has(requiredMaster.toLowerCase()));
    return missing.length > 0;
  });

  if (broken.length === 0) {
    return Promise.resolve(undefined);
  } else {
    return Promise.resolve({
      description: {
        short: 'Missing Masters',
        long:
            'Some of the enabled plugins depend on others that are not enabled: \n' +
                broken.map((plugin) => plugin.name).join(', '),
      },
      severity: 'warning' as types.ProblemSeverity,
    });
  }
}

function init(context: IExtensionContextExt) {
  register(context);
  initPersistor(context);
  context.registerTest('plugins-locked', 'gamemode-activated',
    () => testPluginsLocked(selectors.activeGameId(context.api.store.getState())));

  context.registerTest('master-missing', 'plugins-changed',
    () => testMissingMasters(context.api.store.getState()));

  context.once(() => {
    const store = context.api.store;

    loot = new LootInterface(context);

    Object.keys(store.getState().persistent.profiles)
        .forEach((gameId: string) => {
          context.api.onStateChange(
              ['persistent', 'profiles', gameId], (oldProfiles, newProfiles) => {
                const activeProfileId = selectors.activeProfile(store.getState()).id;
                const oldProfile = oldProfiles[activeProfileId];
                const newProfile = newProfiles[activeProfileId];

                if (oldProfile !== newProfile) {
                  updatePluginList(store, newProfile.modState)
                      .then(() => {
                        context.api.events.emit('autosort-plugins');
                      });
                }
              });
        });

    context.api.onStateChange(['settings', 'profiles', 'nextProfileId'],
      (oldProfileId: string, newProfileId: string) => {
        stopSync();
    });

    context.api.onStateChange(['loadOrder'], () => {
      context.api.events.emit('trigger-test-run', 'plugins-changed', 500);
    });

    context.api.events.on('profile-activated', (newProfileId: string) => {
      const newProfile =
          util.getSafe(store.getState(),
                       ['persistent', 'profiles', newProfileId], {} as any);

      if (!gameSupported(newProfile.gameId)) {
        return;
      }

      updatePluginList(store, newProfile.modState)
          .then(() => {
            startSync(context.api);
            context.api.events.emit('autosort-plugins');
          });
    });

    const currentProfile = selectors.activeProfile(store.getState());
    updatePluginList(store, currentProfile.modState)
    .then(() => {
      startSync(context.api);
      context.api.events.emit('autosort-plugins');
    });
  });

  return true;
}

export default init;
