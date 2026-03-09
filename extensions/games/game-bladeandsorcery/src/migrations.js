const Promise = require('bluebird');
const path = require('path');
const semver = require('semver');

const { GAME_ID, MOD_MANIFEST, BAS_EXEC } = require('./common');
const { isOfficialModType, getModName, streamingAssetsPath, getGameVersion, missingGameJsonError } = require('./util');

const { actions, fs, log, selectors, util } = require('vortex-api');

let _SHOULD_MIGRATE = true;
function migrate010(api, oldVersion) {
  if (semver.gte(oldVersion, '0.1.0')) {
    return Promise.resolve();
  }

  // If the user had not updated to 0.1.X yet, then his mods
  //  are already installed correctly.
  _SHOULD_MIGRATE = false;
}

async function migrate0212(api, oldVersion) {
  if (semver.gte(oldVersion, '0.2.12')) {
    return Promise.resolve();
  }

  const state = api.getState();
  const discovery = selectors.discoveryByGame(state, GAME_ID);
  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const modKeys = Object.keys(mods).filter(id => mods[id].modType === 'bas-legacy-modtype');
  if (discovery?.path === undefined || modKeys.length === 0) {
    return Promise.resolve();
  }

  let gameVer;
  try {
    gameVer = await getGameVersion(discovery, BAS_EXEC);
  } catch (err) {
    return missingGameJsonError(api, err);
  }
  const modType = semver.gte(semver.coerce(gameVer), semver.coerce('8.4'))
    ? 'bas-official-modtype' : 'bas-legacy-modtype';
  if (modType !== 'bas-official-modtype') {
    return Promise.resolve();
  }

  let batched = [actions.setDeploymentNecessary(GAME_ID, true)];
  await api.awaitUI();
  const baseFolder = path.join(discovery.path, streamingAssetsPath());
  await api.emitAndAwait('purge-mods-in-path', GAME_ID, 'bas-legacy-modtype', baseFolder);
  for (const key of modKeys) {
    batched.push(actions.setModType(GAME_ID, key, 'bas-official-modtype'));
  }
  util.batchDispatch(api.store, batched);
  return Promise.resolve();
}

function migrate020(api, oldVersion) {
  if (semver.gte(oldVersion, '0.2.0') || !_SHOULD_MIGRATE) {
    return Promise.resolve();
  }

  const state = api.getState();
  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const modKeys = Object.keys(mods);
  if (modKeys.length === 0) {
    return Promise.resolve();
  }

  const activatorId = util.getSafe(state,
    ['settings', 'mods', 'activator', GAME_ID], undefined);

  const gameDiscovery = util.getSafe(state,
    ['settings', 'gameMode', 'discovered', GAME_ID], undefined);

  if ((gameDiscovery?.path === undefined)
      || (activatorId === undefined)) {
    // we can't migrate if this game is not discovered or has an no deployment method
    log('debug', 'skipping blade and sorcery migration because no deployment set up for it');
    return Promise.resolve();
  }

  // Holds mod ids of mods we failed to migrate.
  let failedToMigrate = [];
  return api.awaitUI()
    .then(() => {
      const baseFolder = path.join(gameDiscovery.path, streamingAssetsPath());
      const modTypes = {
        'bas-official-modtype': path.join(baseFolder, 'Mods'),
        'bas-legacy-modtype': baseFolder,
      };

      const deployedModTypes = modKeys.reduce((accum, key) => {
        const modType = mods[key].type;
        if (!accum.includes(modType) && isOfficialModType(modType)) {
          accum.push(mods[key].type);
        }
        return accum;
      }, []);
      return Promise.resolve({ modTypes, deployedModTypes });
    })
    .then(res => Promise.each(res.deployedModTypes, modType =>
      api.emitAndAwait('purge-mods-in-path', GAME_ID, modType, res.modTypes[modType])))
    .then(() => {
      const officialMods = modKeys.filter(key => isOfficialModType(mods[key].type));
      return Promise.each(officialMods, mod => migrateMod020(api, mods[mod])
        .catch(err => {
          log('error', 'failed to migrate BaS mod', err.message);
          failedToMigrate.push(mod);
          return Promise.resolve();
        }))
    })
    .finally(() => {
      if (failedToMigrate.length > 0) {
        api.sendNotification({
          type: 'warning',
          message: 'Failed to migrate mods',
          actions: [
            { title: 'More', action: (dismiss) =>
              api.showDialog('info', 'Mods failed migration', {
                text: api.translate('As part of implementing the Load Order system for '
                                  + 'Blade and Sorcery 8.4, we were forced to change the way '
                                  + 'we install BaS mods (again). Vortex has just attempted to migrate '
                                  + 'your existing mods to the new file structure but failed. '
                                  + 'These will have to be re-installed manually in order to '
                                  + 'function properly. The mods that require re-installation are:\n\n'
                                  + '{{modIds}}',
                                  { replace: { modIds: failedToMigrate.join('\n') } })
              }, [ { label: 'Close', action: () => dismiss() } ])
            },
          ],
        });
      }
      api.store.dispatch(actions.setDeploymentNecessary(GAME_ID, true));
    });
}

function migrateMod020(api, mod) {
  const state = api.getState();
  const stagingFolder = selectors.installPathForGame(state, GAME_ID);
  const modPath = path.join(stagingFolder, mod.installationPath);
  let allEntries = [];
  return util.walk(modPath, entries => {
    allEntries = allEntries.concat(entries);
  }).then(() => {
    const manifestFiles = allEntries.filter(entry =>
      path.basename(entry).toLowerCase() === MOD_MANIFEST);
    
    if (manifestFiles.length !== 1 || path.dirname(manifestFiles[0]) !== modPath) {
      // mods with multiple manifests were not compatible with the previous
      //  LO system, so it's probably not installed correctly anyway.

      // Additionally if the manifest file isn't installed at the root path of the
      //  mod's installationPath, then we assume that the mod is already installed
      //  correctly - which is possible if the user updates from a very old version
      //  of this extension.
      return Promise.reject(new util.ProcessCanceled(`Cannot migrate: ${path.basename(modPath)}`));
    }

    return getModName(manifestFiles[0], 'Name')
      .then(modName => {
        const newPath = path.join(modPath, modName);
        const directories = allEntries.filter(entry => path.extname(path.basename(entry)) === '')
                                      .map(entry => ({
                                        src: entry,
                                        dest: entry.replace(modPath, newPath)
                                      }))
                                      .sort((a, b) => a.src.length - b.src.length);

        const files = allEntries.filter(entry => path.extname(path.basename(entry)) !== '')
                                .map(entry => ({
                                  src: entry,
                                  dest: entry.replace(modPath, newPath),
                                }));
        let newDirs = [];
        let newFiles = [];
        return Promise.each(directories, dir => fs.ensureDirWritableAsync(dir.dest).tap(() => newDirs.push(dir.dest)))
          .then(() => Promise.each(files, file => fs.linkAsync(file.src, file.dest).tap(() => newFiles.push(file.dest))))
          .catch(err => {
            // migration failed, cleanup all newly created dirs and files
            const dirs = newDirs.sort((a, b) => b.length - a.length);
            return Promise.each([...newFiles, ...dirs], entry =>
              fs.removeAsync(entry).catch(() => Promise.resolve()))
            .then(() => Promise.reject(err))
          })
          .then(() => Promise.each(files, file => fs.removeAsync(file.src)))
          .then(() => Promise.each(directories, dir => fs.removeAsync(dir.src)))
      });
  })
}

module.exports = {
  migrate010,
  migrate020,
  migrate0212,
}