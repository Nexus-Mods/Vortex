import PluginList from './PluginList';

import Promise from 'bluebird';
import * as path from 'path';
import { fs, log, selectors, types, util } from 'vortex-api';
import IniParser, { WinapiFormat } from 'vortex-parse-ini';

let watcher: fs.FSWatcher;
let refresher: util.Debouncer;

const reactive = util.makeReactive({
  knownPlugins: [],
  pluginOrder: [],
});

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
  if ((discovery === undefined) || (discovery.path === undefined)) {
    // this shouldn't happen because startWatch is only called if the
    // game is activated and it has to be discovered for that
    throw new Error('Morrowind wasn\'t discovered');
  }
  watcher = fs.watch(path.join(discovery.path, 'Data Files'), {}, onFileChanged)
    .on('error', err => {
      log('error', 'failed to watch morrowind mod directory for changes', { message: err.message });
    });
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
      return parser.write(iniFilePath, ini);
    });
}

function updatePluginTimestamps(dataPath: string, plugins: string[]): Promise<void> {
  const offset = 946684800;
  const oneDay = 24 * 60 * 60;
  return Promise.mapSeries(plugins, (fileName, idx) => {
    const mtime = offset + oneDay * idx;
    return fs.utimesAsync(path.join(dataPath, fileName), mtime, mtime)
      .catch(err => err.code === 'ENOENT'
        ? Promise.resolve()
        : Promise.reject(err));
  }).then(() => undefined);
}

function refreshPlugins(api: types.IExtensionApi): Promise<void> {
  const state = api.store.getState();
  const discovery = state.settings.gameMode.discovered['morrowind'];
  if ((discovery === undefined) || (discovery.path === undefined)) {
    return Promise.resolve();
  }

  return fs.readdirAsync(path.join(discovery.path, 'Data Files'))
    .filter((fileName: string) =>
              ['.esp', '.esm'].indexOf(path.extname(fileName).toLowerCase()) !== -1)
    .then(plugins =>
      readGameFiles(path.join(discovery.path, 'Morrowind.ini'))
        .then(gameFiles => ({ plugins, gameFiles })))
    .then(result => {
      reactive.knownPlugins = result.plugins;
      reactive.pluginOrder = result.gameFiles;
    });
}

function init(context: types.IExtensionContext) {
  context.registerMainPage('plugins', 'Plugins', PluginList, {
    id: 'morrowind-plugins',
    hotkey: 'E',
    group: 'per-game',
    visible: () => selectors.activeGameId(context.api.store.getState()) === 'morrowind',
    props: () => ({
      localState: reactive,
      onSetPluginOrder: (plugins: string[]) => {
        const state = context.api.store.getState();
        reactive.pluginOrder = plugins;
        const discovery = state.settings.gameMode.discovered['morrowind'];
        const iniFilePath = path.join(discovery.path, 'Morrowind.ini');
        updatePluginOrder(iniFilePath, plugins)
          .then(() => updatePluginTimestamps(path.join(discovery.path, 'Data Files'), plugins))
          .catch(err => {
            context.api.showErrorNotification('Failed to update morrowind.ini',
                                              err, { allowReport: false });
          });
      },
    }),
  });

  context.once(() => {
    context.api.events.on('gamemode-activated', (gameMode: string) => {
      if (gameMode === 'morrowind') {
        startWatch(context.api.store.getState());
      } else {
        stopWatch();
      }
    });

    context.api.setStylesheet('morrowind-plugin-management',
                              path.join(__dirname, 'stylesheet.scss'));

    refresher = new util.Debouncer(() =>
      refreshPlugins(context.api), 2000);
    refresher.schedule();

  });
}

export default init;
