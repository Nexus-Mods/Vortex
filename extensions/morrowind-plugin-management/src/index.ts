import PluginList from './PluginList';

import * as Promise from 'bluebird';
import * as fs from 'fs-extra-promise';
import * as path from 'path';
import { selectors, types, util } from 'vortex-api';
import IniParser, { IniFile, WinapiFormat } from 'vortex-parse-ini';

let watcher: fs.FSWatcher;
let refresher: util.Debouncer;
let knownPlugins: string[] = util.makeReactive([]);
let pluginOrder: string[] = util.makeReactive([]);

function onFileChanged(event: string, fileName: string) {
  if (event === 'rename') {
    const ext = path.extname(fileName).toLowerCase();
    if ((ext === '.esm') || (ext === '.esp')) {
      refresher.schedule();
    }
  }
}

function startWatch(state: types.IState) {
  const discovery = state.settings.gameMode.discovered['morrowind'];
  if (discovery === undefined) {
    // this shouldn't happen because startWatch is only called if the
    // game is activated and it has to be discovered for that
    throw new Error('Morrowind wasn\'t discovered');
  }
  watcher = fs.watch(path.join(discovery.path, 'Data Files'), {}, onFileChanged);
}

function stopWatch() {
  if (watcher !== undefined) {
    watcher.close();
    watcher = undefined;
  }
}

function readGameFiles(iniFilePath: string): Promise<string[]> {
  const parser = new IniParser(new WinapiFormat());
  return parser.read(iniFilePath)
    .then(ini => {
      const files = ini.data['Game Files'];
      return Object.keys(files).map(key => files[key]);
    });
}

function updatePluginOrder(iniFilePath: string, plugins: string[]) {
  const parser = new IniParser(new WinapiFormat());
  return parser.read(iniFilePath)
    .then(ini => {
      ini.data['Game Files'] = plugins.reduce((prev, plugin, idx) => {
        prev[`GameFile${idx}`] = plugin;
        return prev;
      }, {});
      parser.write(iniFilePath, ini);
    });
}

function refreshPlugins(api: types.IExtensionApi): Promise<void> {
  const state = api.store.getState();
  const discovery = state.settings.gameMode.discovered['morrowind'];

  return fs.readdirAsync(path.join(discovery.path, 'Data Files'))
    .filter((fileName: string) =>
              ['.esp', '.esm'].indexOf(path.extname(fileName).toLowerCase()) !== -1)
    .then(plugins =>
      readGameFiles(path.join(discovery.path, 'Morrowind.ini'))
        .then(gameFiles => ({ plugins, gameFiles })))
    .then(result => {
      knownPlugins = result.plugins;
      pluginOrder = result.gameFiles;
    });
}

function init(context: types.IExtensionContext) {
  context.registerMainPage('plugins', 'Plugins', PluginList, {
    id: 'morrowind-plugins',
    hotkey: 'E',
    group: 'per-game',
    visible: () => selectors.activeGameId(context.api.store.getState()) === 'morrowind',
    props: () => ({
      knownPlugins,
      pluginOrder,
      onSetPluginOrder: (plugins: string[]) => {
        const state = context.api.store.getState();
        const discovery = state.settings.gameMode.discovered['morrowind'];
        const iniFilePath = path.join(discovery.path, 'Morrowind.ini');
        updatePluginOrder(iniFilePath, plugins);
      }
    }),
  });

  context.once(() => {
    const state: types.IState = context.api.store.getState();
    context.api.events.on('gamemode-activated', (gameMode: string) => {
      if (gameMode === 'morrowind') {
        startWatch(context.api.store.getState());
      } else {
        stopWatch();
      }
    });

    context.api.setStylesheet('morrowind-plugin-management',
                              path.join(__dirname, 'stylesheet.scss'));

    refresher = new util.Debouncer(() => {
      return refreshPlugins(context.api);
    }, 2000);
    refresher.schedule();

  });
}

export default init;
