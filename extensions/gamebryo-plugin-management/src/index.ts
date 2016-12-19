import {updateLoadOrder} from './actions/loadOrder';
import {setPluginList} from './actions/plugins';
import {loadOrderReducer} from './reducers/loadOrder';
import {pluginsReducer} from './reducers/plugins';
import {settingsReducer} from './reducers/settings';
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
import * as fs from 'fs-extra-promise';
import { types, util } from 'nmm-api';
import * as path from 'path';

interface IModState {
  enabled: boolean;
}

type IModStates = { [modId: string]: IModState };

function isPlugin(fileName: string): boolean {
  return ['.esp', '.esm'].indexOf(path.extname(fileName).toLowerCase()) !== -1;
}

function updatePluginList(store: Redux.Store<any>, oldModList: IModStates,
                          newModList: IModStates): Promise<void> {
  if (newModList === undefined) {
    return;
  }

  let state = store.getState();

  let gameName = state.settings.gameMode.current;
  let pluginSources: { [pluginName: string]: string } = {};
  let modPath = util.currentGameDiscovery(state).modPath;

  return Promise.map(Object.keys(state.mods.mods), (modId: string) => {
    let mod = state.mods.mods[modId];
    return fs.readdirAsync(mod.installationPath)
    .then((fileNames: string[]) => {
      fileNames
      .filter((fileName: string) => ['.esp', '.esm'].indexOf(path.extname(fileName)) !== -1)
      .forEach((fileName: string) => {
        pluginSources[fileName] = mod.name || mod.id;
      });
    });
  })
  .then(() => {
    return fs.readdirAsync(modPath);
  })
  .then((fileNames: string[]) => {
    let pluginNames: string[] = fileNames.filter(isPlugin);
    let pluginStates: IPlugins = {};
    pluginNames.forEach((fileName: string) => {
      let modName = pluginSources[fileName];
      pluginStates[fileName] = {
        modName: modName || '',
        filePath: path.join(modPath, fileName),
        isNative: modName === undefined && isNativePlugin(gameName, fileName),
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

function init(context: IExtensionContextExt) {

  context.registerMainPage('puzzle-piece', 'Plugins', PluginList, {
    hotkey: 'E',
    visible: () => gameSupported(context.api.store.getState().settings.gameMode.current),
    props: () => ({
      nativePlugins: nativePlugins(context.api.store.getState().settings.gameMode.current),
    }),
  });

  if (context.registerProfileFile) {
    for (let game of supportedGames()) {
      context.registerProfileFile(game, path.join(pluginPath(game), 'plugins.txt'));
      context.registerProfileFile(game, path.join(pluginPath(game), 'loadorder.txt'));
    }
  }

  context.registerReducer(['session', 'plugins'], pluginsReducer);
  context.registerReducer(['loadOrder'], loadOrderReducer);
  context.registerReducer(['settings', 'plugins'], settingsReducer);

  // TODO: Currently need to stop this from being called in the main process.
  //   This is mega-ugly and needs to go
  if ((persistor === undefined) && (remote !== undefined)) {
    persistor = new PluginPersistor();
  }
  if (persistor !== undefined) {
    context.registerPersistor('loadOrder', persistor);
  }

  context.once(() => {
    const store = context.api.store;

    loot = new LootInterface(context);

    let currentProfile: string =
      util.getSafe(store.getState(), ['gameSettings', 'profiles', 'currentProfile'], undefined);

    updatePluginList(store, {}, util.getSafe(store.getState(),
      ['gameSettings', 'profiles', 'profiles', currentProfile], {} as any).modState);

    let watcher: fs.FSWatcher;

    context.api.events.on('gamemode-activated', (newGameMode: string) => {
      if (watcher !== undefined) {
        watcher.close();
        watcher = undefined;
      }
      if (!gameSupported(newGameMode)) {
        return;
      }
      if (persistor !== undefined) {
        persistor.loadFiles(newGameMode);
        let modPath = util.currentGameDiscovery(store.getState()).modPath;
        watcher = fs.watch(modPath, {}, (evt: string, fileName: string) => {
          if (refreshTimer !== undefined) {
            clearTimeout(refreshTimer);
          }
          refreshTimer = setTimeout(() => {
            let profile = util.getSafe(store.getState(),
                                       [
                                         'gameSettings',
                                         'profiles',
                                         'profiles',
                                         currentProfile,
                                       ],
                                       {} as any);
            updatePluginList(store, {}, profile.modState)
                .then(() => { context.api.events.emit('autosort-plugins'); });
            refreshTimer = undefined;
          }, 500);
        });
      }
    });

    context.api.onStateChange(
        ['gameSettings', 'profiles', 'profiles', currentProfile],
        (oldModList, newModList) => {
          updatePluginList(store, oldModList.modState, newModList.modState)
          .then(() => {
            context.api.events.emit('autosort-plugins');
          });
        });

    context.api.onStateChange(
        ['gameSettings', 'profiles', 'currentProfile'],
        (oldProfile, newProfile) => {
          updatePluginList(store,
              util.getSafe(store.getState(),
                           ['gameSettings', 'profiles', 'profiles', oldProfile],
                           {} as any).modState,
              util.getSafe(store.getState(),
                           ['gameSettings', 'profiles', 'profiles', newProfile],
                           {} as any).modState)
          .then(() => {
            context.api.events.emit('autosort-plugins');
          });
          currentProfile = newProfile;
        });
  });

  return true;
}

export default init;
