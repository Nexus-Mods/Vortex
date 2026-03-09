/* eslint-disable */
import path from 'path';
import Bluebird from 'bluebird';
import { actions, fs, log, selectors, types, util } from 'vortex-api';
const IniParser = require('vortex-parse-ini');
import { generate } from 'shortid';

import { getPersistentLoadOrder } from './migrations';
import { prepareFileData, restoreFileData } from './collections/util';
import { getDeployment } from './util';
import { GAME_ID, INPUT_XML_FILENAME, PART_SUFFIX } from './common';

// most of these are invalid on windows only but it's not worth the effort allowing them elsewhere
const INVALID_CHARS = /[:/\\*?"<>|]/g;
const INPUT_SETTINGS_FILENAME = 'input.settings';
const DX_11_USER_SETTINGS_FILENAME = 'user.settings';
const DX_12_USER_SETTINGS_FILENAME = 'dx12user.settings';
const BACKUP_TAG = '.vortex_backup';

interface ICacheEntry {
  id: string;
  filepath: string;
  data: string;
}

type IFileMap = { [entryId: string]: ICacheEntry[] };

// We're going to save per mod ini settings for each
//  file (where applicable) into this cache file so
//  we can keep track of changes that the user made
//  during his playthrough.
const CACHE_FILENAME = 'vortex_menumod.cache'
/* Cache format should be as follows:
  [
    {
      id: $modId
      filepath: '../input.settings',
      data: 'ini data in string format',
    },
    {
      id: $modId
      filename: '../user.settings',
      data: 'ini data in string format',
    },
  ]
*/
async function getExistingCache(state, activeProfile) {
  const stagingFolder = selectors.installPathForGame(state, GAME_ID);
  const modName = menuMod(activeProfile.name);
  const mod = util.getSafe(state, ['persistent', 'mods', GAME_ID, modName], undefined);
  if (mod === undefined) {
    return [];
  }

  try {
    const cacheData = await fs.readFileAsync(path.join(stagingFolder,
      mod.installationPath, CACHE_FILENAME), { encoding: 'utf8' });
    const currentCache = JSON.parse(cacheData);
    return currentCache;
  } catch (err) {
    // We were unable to read/parse the cache file - this is perfectly
    //  valid when the cache file hasn't been created yet, and even if/when
    //  the error is more serious - we shouldn't block the deployment.
    log('warn', 'W3: failed to read/parse cache file', err);
    return [];
  }
}

function toFileMapKey(filePath) {
  return path.basename(filePath)
             .toLowerCase()
             .replace(PART_SUFFIX, '');
};

function readModData(filePath) {
  return fs.readFileAsync(filePath, { encoding: 'utf8' })
    .catch(err => Promise.resolve(undefined));
}

function populateCache(api: types.IExtensionApi, activeProfile: types.IProfile, modIds?: string[], initialCacheValue?: ICacheEntry[]) {
  const state = api.store.getState();
  const loadOrder = getPersistentLoadOrder(api);
  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const modState = util.getSafe(activeProfile, ['modState'], {});

  let nextAvailableId = Object.keys(loadOrder).length;
  const getNextId = () => {
    return nextAvailableId++;
  }
  const toIdx = (loItem) => (loadOrder.indexOf(loItem) || getNextId());
  const invalidModTypes = ['witcher3menumoddocuments'];
  const affectedModIds = modIds === undefined ? Object.keys(mods) : modIds;
  const enabledMods = affectedModIds
    .filter(key => (mods[key]?.installationPath !== undefined)
                && !!modState[key]?.enabled &&
                !invalidModTypes.includes(mods[key].type))
    .sort((lhs, rhs) => (toIdx(lhs)) - (toIdx(rhs)))
    .map(key => mods[key]);

  const getRelevantModEntries = async (source) => {
    let allEntries = [];
    await require('turbowalk').default(source, entries => {
      const relevantEntries = entries.filter(entry =>
           (entry.filePath.endsWith(PART_SUFFIX))
        && (entry.filePath.indexOf(INPUT_XML_FILENAME) === -1))
              .map(entry => entry.filePath);

      allEntries = [].concat(allEntries, relevantEntries);
    }).catch(err => {
      if  (['ENOENT', 'ENOTFOUND'].indexOf(err.code) === -1) {
        log('error', 'Failed to lookup menu mod files',
          { path: source, error: err.message });
      }
    })

    return allEntries;
  };

  const stagingFolder = selectors.installPathForGame(state, GAME_ID);
  return Bluebird.reduce(enabledMods, (accum, mod: types.IMod) => {
    if (mod.installationPath === undefined) {
      return accum;
    }
    return getRelevantModEntries(path.join(stagingFolder, mod.installationPath))
      .then(entries => {
        return Bluebird.each(entries, filepath => {
          return readModData(filepath)
            .then(data => {
              if (data !== undefined) {
                accum.push({ id: mod.id, filepath, data });
              }
            })
        })
        .then(() => Promise.resolve(accum))
      })
  }, initialCacheValue !== undefined ? initialCacheValue : [])
  .then(newCache => {
    const modName = menuMod(activeProfile.name);
    let mod = util.getSafe(state, ['persistent', 'mods', GAME_ID, modName], undefined);
    if (mod?.installationPath === undefined) {
      log('warn', 'failed to ascertain installation path', modName);
      // We will create it on the next run.
      return Promise.resolve();
    }

    return fs.writeFileAsync(path.join(stagingFolder, mod.installationPath, CACHE_FILENAME), JSON.stringify(newCache));
  });
}

function convertFilePath(filePath, installPath) { 
  // Pre-collections we would use absolute paths pointing
  //  to the menu mod input modifications; this will obviously
  //  work just fine on the curator's end, but relpaths should be used
  //  on the user's end. This functor will convert the abs path from
  //  the curator's path to the user's path.
  const segments = filePath.split(path.sep);
  const idx = segments.reduce((prev, seg, idx) => {
    if (seg.toLowerCase() === GAME_ID) {
      return idx;
    } else {
      return prev;
    }
  }, -1);
  if (idx === -1) {
    log('error', 'unexpected menu mod filepath', filePath);
    return filePath;
  }
  // We slice off everything up to the GAME_ID and the 'mods' folder.
  const relPath = segments.slice(idx + 2).join(path.sep);
  return path.join(installPath, relPath);
}

export async function onWillDeploy(api, deployment, activeProfile) {
  // if (!isSettingsMergeSuppressed(api)) {
  //   return;
  // }
  const state = api.store.getState();
  if (activeProfile?.name === undefined) {
    return;
  }
  const installPath = selectors.installPathForGame(state, activeProfile.gameId);
  const modName = menuMod(activeProfile.name);
  const destinationFolder = path.join(installPath, modName);
  const game = util.getGame(activeProfile.gameId);
  const discovery = selectors.discoveryByGame(state, activeProfile.gameId);
  const modPaths = game.getModPaths(discovery.path);
  const docModPath = modPaths['witcher3menumoddocuments'];
  const currentCache = await getExistingCache(state, activeProfile);
  if (currentCache.length === 0) {
    // Nothing to compare, user does not have a cache.
    return;
  }

  const docFiles = (deployment['witcher3menumodroot'] ?? [])
    .filter(file => (file.relPath.endsWith(PART_SUFFIX))
                 && (file.relPath.indexOf(INPUT_XML_FILENAME) === -1));

  if (docFiles.length <= 0) {
    // No doc files, no problem.
    return;
  }

  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const modState = util.getSafe(activeProfile, ['modState'], {});
  const invalidModTypes = ['witcher3menumoddocuments'];
  const enabledMods = Object.keys(mods)
    .filter(key => !!modState[key]?.enabled && !invalidModTypes.includes(mods[key].type));

  const parser = new IniParser.default(new IniParser.WinapiFormat());

  const fileMap = await cacheToFileMap(state, activeProfile);
  if (fileMap === undefined) {
    return;
  }

  const keys = Object.keys(fileMap);
  const matcher = (entry) => keys.includes(toFileMapKey(entry.relPath));
  const newCache = await Bluebird.reduce(keys, async (accum, key) => {
    if (docFiles.find(matcher) !== undefined) {
      const mergedData = await parser.read(path.join(docModPath, key));
      await Bluebird.each(fileMap[key], async (iter: ICacheEntry) => {
        if (enabledMods.includes(iter.id)) {
          const tempPath = path.join(destinationFolder, key) + generate();
          const modData = await toIniFileObject(iter.data, tempPath);
          const modKeys = Object.keys(modData.data);
          let changed = false;
          return Bluebird.each(modKeys, modKey => {
            if ((mergedData.data[modKey] !== undefined)
              && (modData.data[modKey] !== undefined)
              && (mergedData.data[modKey] !== modData.data[modKey])) {
                modData.data[modKey] = mergedData.data[modKey];
                changed = true;
            }
          }).then(async () => {
            let newModData;
            if (changed) {
              await parser.write(iter.filepath, modData);
              newModData = await readModData(iter.filepath);
            } else {
              newModData = iter.data;
            }

            if (newModData !== undefined) {
              accum.push({ id: iter.id, filepath: iter.filepath, data: newModData });
            }
          });
        }
      });
    }
    return Promise.resolve(accum);
  }, []);

  return fs.writeFileAsync(path.join(destinationFolder, CACHE_FILENAME), JSON.stringify(newCache));
}

async function toIniFileObject(data, tempDest) {
  // Given that winapi requires a file to correctly read/parse
  //  an IniFile object, we're going to use this hacky disgusting
  //  function to quickly create a temp file, read it, destroy it
  //  and return the object back to the caller.
  try {
    await fs.writeFileAsync(tempDest, data, { encoding: 'utf8' });
    const parser = new IniParser.default(new IniParser.WinapiFormat());
    const iniData = await parser.read(tempDest);
    await fs.removeAsync(tempDest);
    return Promise.resolve(iniData);
  } catch (err) {
    return Promise.reject(err);
  }
}

export async function onDidDeploy(api, deployment, activeProfile) {
  // if (!isSettingsMergeSuppressed(api)) {
  //   return;
  // }
  const state = api.store.getState();
  const loadOrder = getPersistentLoadOrder(api);
  const docFiles = deployment['witcher3menumodroot'].filter(file => (file.relPath.endsWith(PART_SUFFIX))
    && (file.relPath.indexOf(INPUT_XML_FILENAME) === -1));

  if (docFiles.length <= 0) {
    return;
  }

  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const modState = util.getSafe(activeProfile, ['modState'], {});
  let nextAvailableId = loadOrder.length;
  const getNextId = () => {
    return nextAvailableId++;
  }
  const invalidModTypes = ['witcher3menumoddocuments'];
  const enabledMods = Object.keys(mods)
    .filter(key => !!modState[key]?.enabled && !invalidModTypes.includes(mods[key].type))
    .sort((lhs, rhs) => (loadOrder[rhs]?.pos || getNextId()) - (loadOrder[lhs]?.pos || getNextId()))

  const currentCache = await getExistingCache(state, activeProfile);
  const inCache = new Set(currentCache.map(entry => entry.id));
  const notInCache: Set<string> = new Set(docFiles.map(file => file.source)
                                     .filter(modId => !inCache.has(modId)));
  return ensureMenuMod(api, activeProfile)
    .then(() => ((currentCache.length === 0) && (enabledMods.length > 0))
      ? populateCache(api, activeProfile)
      : (notInCache.size !== 0)
        ? populateCache(api, activeProfile, Array.from(notInCache), currentCache)
        : Promise.resolve())
    .then(() => writeCacheToFiles(api, activeProfile))
    .then(() => menuMod(activeProfile.name))
    .catch(err => (err instanceof util.UserCanceled)
      ? Promise.resolve()
      : Promise.reject(err));
}

function sanitizeProfileName(input) {
  return input.replace(INVALID_CHARS, '_');
}

export function menuMod(profileName) {
  return `Witcher 3 Menu Mod Data (${sanitizeProfileName(profileName)})`;
}

async function createMenuMod(api, modName, profile) {
  const mod = {
    id: modName,
    state: 'installed',
    attributes: {
      name: 'Witcher 3 Menu Mod',
      description: 'This mod is a collective merge of setting files required by any/all '
                 + 'menu mods the user has installed - please do not disable/remove unless '
                 + 'all menu mods have been removed from your game first.',
      logicalFileName: 'Witcher 3 Menu Mod',
      modId: 42, // Meaning of life
      version: '1.0.0',
      variant: sanitizeProfileName(profile.name.replace(INVALID_CHARS, '_')),
      installTime: new Date(),
    },
    installationPath: modName,
    type: 'witcher3menumoddocuments',
  };

  return await new Promise<void>((resolve, reject) => {
    api.events.emit('create-mod', profile.gameId, mod, async (error) => {
      if (error !== null) {
        return reject(error);
      }
      resolve();
    });
  });
}

export async function removeMenuMod(api, profile) {
  // if (!isSettingsMergeSuppressed(api)) {
  //   return Promise.resolve();
  // }
  const state = api.store.getState();
  const modName = menuMod(profile.name);
  const mod = util.getSafe(state, ['persistent', 'mods', profile.gameId, modName], undefined);
  if (mod === undefined) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    api.events.emit('remove-mod', profile.gameId, mod.id, async (error) => {
      if (error !== null) {
        // The fact that we're attempting to remove the aggregated menu mod means that
        //  the user no longer has any menu mods installed and therefore it's safe to
        //  ignore any errors that may have been raised during removal.
        // The main problem here is the fact that users are actively messing with
        //  the menu mod we generate causing odd errors to pop up.
        log('error', 'failed to remove menu mod', error);
        // return reject(error);
      }
      return resolve();
    });
  });
}

async function cacheToFileMap(state, profile) {
  // Organizes cache entries into a fileMap which
  //  can be used to loop through each mod entry's
  //  data on a per file basis.
  const currentCache = await getExistingCache(state, profile);
  if (currentCache.length === 0) {
    // Nothing to do here.
    return undefined;
  }

  const stagingFolder = selectors.installPathForGame(state, GAME_ID);
  const fileMap = currentCache.reduce((accum, entry) => {
    accum[toFileMapKey(entry.filepath)] =
      [].concat(accum[toFileMapKey(entry.filepath)] || [],
      [{
        id: entry.id,
        data: entry.data,
        filepath: convertFilePath(entry.filepath, stagingFolder),
      }]);

    return accum;
  }, {});

  return fileMap;
}

const copyIniFile = (source: string, dest: string) => fs.copyAsync(source, dest)
    .then(() => Promise.resolve(dest)).catch(err => Promise.resolve(undefined));

const getInitialDoc = (filePath: string) => {
  return fs.statAsync(filePath + BACKUP_TAG)
    .then(() => Promise.resolve(filePath + BACKUP_TAG))
    .catch(err => fs.statAsync(filePath)
      .then(() => Promise.resolve(filePath)))
    .catch(err => {
      // We couldn't find the original document. This
      //  can potentially happen when the .part.txt suffix
      //  gets added to files that are not supposed to be
      //  deployed to the documents folder, log and continue.
      log('warn', 'W3: cannot find original file', err.message);
      return Promise.resolve(undefined);
    });
};

async function writeCacheToFiles(api, profile) {
  const state = api.store.getState();
  const modName = menuMod(profile.name);
  const installPath = selectors.installPathForGame(state, profile.gameId);
  const destinationFolder = path.join(installPath, modName);
  const game = util.getGame(profile.gameId);
  const discovery = selectors.discoveryByGame(state, profile.gameId);
  const modPaths = game.getModPaths(discovery.path);
  const docModPath = modPaths['witcher3menumoddocuments'];
  const currentCache = await getExistingCache(state, profile);
  if (currentCache.length === 0) return;

  const fileMap = await cacheToFileMap(state, profile);
  if (!fileMap) return;

  const parser = new IniParser.default(new IniParser.WinapiFormat());
  const keys = Object.keys(fileMap);

  for (const key of keys) {
    try {
      const source = await getInitialDoc(path.join(docModPath, key));
      if (!source) continue;

      await copyIniFile(source, path.join(destinationFolder, key));
      const initialData = await parser.read(path.join(destinationFolder, key));

      for (const modEntry of fileMap[key]) {
        const tempFilePath = path.join(destinationFolder, key) + generate();
        const modData = await toIniFileObject(modEntry.data, tempFilePath);

        for (const modKey of Object.keys(modData.data)) {
          initialData.data[modKey] = {
            ...initialData.data[modKey],
            ...modData.data[modKey],
          };
        }
      }
      await parser.write(path.join(destinationFolder, key), initialData);
    } catch (err) {
      if (err.code === 'ENOENT' && [
        path.join(docModPath, INPUT_SETTINGS_FILENAME),
        path.join(docModPath, DX_11_USER_SETTINGS_FILENAME),
        path.join(docModPath, DX_12_USER_SETTINGS_FILENAME),
      ].includes(err.path)) {
        api.showErrorNotification('Failed to install menu mod', new util.DataInvalid('Required setting files are missing - please run the game at least once and try again.'), { allowReport: false });
        return;
      }
      throw err;
    }
  }
}

export async function ensureMenuMod(api, profile) {
  // if (!isSettingsMergeSuppressed(api)) {
  //   return Promise.resolve(undefined);
  // }
  const state = api.store.getState();
  const modName = menuMod(profile.name);
  const mod = util.getSafe(state, ['persistent', 'mods', profile.gameId, modName], undefined);
  if (mod === undefined) {
    try {
      await createMenuMod(api, modName, profile);
    } catch (err) {
      return Promise.reject(err);
    }
  } else {
    // give the user an indication when this was last updated
    api.store.dispatch(actions.setModAttribute(profile.gameId, modName, 'installTime', new Date()));
    // the rest here is only required to update mods from previous vortex versions
    api.store.dispatch(actions.setModAttribute(profile.gameId, modName,
                                               'name', 'Witcher 3 Menu Mod'));

    api.store.dispatch(actions.setModAttribute(profile.gameId, modName,
                                               'type', 'witcher3menumoddocuments'));

    api.store.dispatch(actions.setModAttribute(profile.gameId, modName,
                                               'logicalFileName', 'Witcher 3 Menu Mod'));
    api.store.dispatch(actions.setModAttribute(profile.gameId, modName, 'modId', 42));
    api.store.dispatch(actions.setModAttribute(profile.gameId, modName, 'version', '1.0.0'));
    api.store.dispatch(actions.setModAttribute(profile.gameId, modName, 'variant',
                                               sanitizeProfileName(profile.name)));
  }
  return Promise.resolve(modName);
}

export async function exportMenuMod(api, profile, includedMods) {
  // if (!isSettingsMergeSuppressed(api)) {
  //   return undefined;
  // }
  try {
    const deployment = await getDeployment(api, includedMods);
    if (deployment === undefined) {
      throw new Error('Failed to get deployment');
    }
    const modName = await onDidDeploy(api, deployment, profile);
    if (modName === undefined) {
      // The installed mods do not require a menu mod.
      return undefined;
    }
    const mods = util.getSafe(api.getState(), ['persistent', 'mods', GAME_ID], {});
    const modId = Object.keys(mods).find(id => id === modName);
    if (modId === undefined) {
      throw new Error('Menu mod is missing');
    }
    const installPath = selectors.installPathForGame(api.getState(), GAME_ID);
    const modPath = path.join(installPath, mods[modId].installationPath);
    const data = await prepareFileData(modPath);
    return data;
  } catch (err) {
    return Promise.reject(err);
  }
}

export async function importMenuMod(api, profile, fileData) {
  // if (!isSettingsMergeSuppressed(api)) {
  //   return Promise.resolve(undefined);
  // }
  try {
    const modName = await ensureMenuMod(api, profile);
    const mod = util.getSafe(api.getState(), ['persistent', 'mods', profile.gameId, modName], undefined);
    const installPath = selectors.installPathForGame(api.getState(), GAME_ID);
    const destPath = path.join(installPath, mod.installationPath);
    await restoreFileData(fileData, destPath);
  } catch (err) {
    return Promise.reject(err);
  }
}
