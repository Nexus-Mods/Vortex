const path = require('path');
const { fs, selectors, util } = require('vortex-api');
const { default: IniParser, WinapiFormat } = require('vortex-parse-ini');

const { MORROWIND_ID } = require('./constants');

async function validate(before, after) {
  return Promise.resolve();
}

async function deserializeLoadOrder(api, mods = undefined) {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, MORROWIND_ID);
  if (discovery?.path === undefined) {
    return Promise.resolve([]);
  }
  if (mods === undefined) {
    mods = util.getSafe(state, ['persistent', 'mods', MORROWIND_ID], {});
  }
  const fileMap = Object.keys(mods).reduce((accum, iter) => {
    const plugins = mods[iter]?.attributes?.plugins;
    if (mods[iter]?.attributes?.plugins !== undefined) {
      for (const plugin of plugins) {
        accum[plugin] = iter;
      }
    }
    return accum;
  }, {});

  const iniFilePath = path.join(discovery.path, 'Morrowind.ini');
  const gameFiles = await refreshPlugins(api);
  const enabled = await readGameFiles(iniFilePath);
  return gameFiles.sort((lhs, rhs) => lhs.mtime - rhs.mtime)
    .map((file) => ({
      id: file.name,
      enabled: enabled.includes(file.name),
      name: file.name,
      modId: fileMap[file.name],
    }));
}

async function refreshPlugins(api) {
  const state = api.getState()
  const discovery = selectors.discoveryByGame(state, MORROWIND_ID);
  if (discovery?.path === undefined) {
    return Promise.resolve([]);
  }

  const dataDirectory = path.join(discovery.path, 'Data Files');
  let fileEntries = [];
  try {
    fileEntries = await fs.readdirAsync(dataDirectory);
  } catch (err) {
    // No data directory - no problem!
    return Promise.resolve([]);
  }
  const pluginEntries = [];
  for (const fileName of fileEntries) {
    if (!['.esp', '.esm'].includes(path.extname(fileName.toLocaleLowerCase()))) {
      continue;
    }
    let stats;
    try {
      stats = await fs.statAsync(path.join(dataDirectory, fileName));
      pluginEntries.push({ name: fileName, mtime: stats.mtime });
    } catch (err) {
      if (err.code === 'ENOENT') {
        // Probably a deployment event.
        continue;
      } else {
        return Promise.reject(err);
      }
    }
  }

  return Promise.resolve(pluginEntries);
}

async function readGameFiles(iniFilePath) {
  const parser = new IniParser(new WinapiFormat());
  return parser.read(iniFilePath)
    .then(ini => {
      const files = ini.data['Game Files'];
      return Object.keys(files ?? {}).map(key => files[key]);
    });
}

async function updatePluginOrder(iniFilePath, plugins) {
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

async function updatePluginTimestamps(dataPath, plugins) {
  const offset = 946684800;
  const oneDay = 24 * 60 * 60;
  return Promise.mapSeries(plugins, (fileName, idx) => {
    const mtime = offset + oneDay * idx;
    return fs.utimesAsync(path.join(dataPath, fileName), mtime, mtime)
      .catch(err => err.code === 'ENOENT'
        ? Promise.resolve()
        : Promise.reject(err));
  });
}

async function serializeLoadOrder(api, order) {
  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, MORROWIND_ID);
  if (discovery?.path === undefined) {
    return Promise.reject(new util.ProcessCanceled('Game is not discovered'));
  }

  const iniFilePath = path.join(discovery.path, 'Morrowind.ini');
  const dataDirectory = path.join(discovery.path, 'Data Files');
  const enabled = order.filter(loEntry => loEntry.enabled === true).map(loEntry => loEntry.id);
  try {
    await updatePluginOrder(iniFilePath, enabled);
    await updatePluginTimestamps(dataDirectory, order.map(loEntry => loEntry.id));
  } catch (err) {
    const allowReport = !(err instanceof util.UserCanceled);
    api.showErrorNotification('Failed to save', err, { allowReport });
    return Promise.reject(err);
  }
  return Promise.resolve();
}

module.exports = {
  deserializeLoadOrder,
  serializeLoadOrder,
  readGameFiles,
  validate,
};