// import { runPatcher } from 'harmony-patcher';
import path from 'path';
import semver from 'semver';
import { fs } from 'vortex-api';

import { DATAPATH, ENTRY_POINT, GAME_ID } from './statics';
import { getDiscoveryPath } from './util';

/*
export function migrate010(context, oldVersion) {
  if (semver.gte(oldVersion, '0.1.0')) {
    return Promise.resolve();
  }

  const state = context.api.store.getState();
  const discoveryPath = getDiscoveryPath(state);
  if (discoveryPath === undefined) {
    // Game was not discovered, this is a valid use case.
    //  User might not own the game.
    return Promise.resolve();
  }

  const absPath = path.join(discoveryPath, DATAPATH);
  const assemblyPath = path.join(absPath, 'VortexHarmonyInstaller.dll');
  // Test if the patch exists and remove it, if it is.
  return fs.statAsync(assemblyPath)
    .then(() => runPatcher(__dirname, absPath, ENTRY_POINT, true,
      path.join(getDiscoveryPath(state), DATAPATH, 'VortexMods')))
    .catch(err => err.code === 'ENOENT' ? Promise.resolve() : Promise.reject(err));
}
*/

export function migrate020(context, oldVersion) {
  if (semver.gte(oldVersion, '0.2.0')) {
    return Promise.resolve();
  }

  const discoveryPath = getDiscoveryPath(context.api.getState());
  if (discoveryPath === undefined) {
    // Game was not discovered, this is a valid use case.
    //  User might not own the game.
    return Promise.resolve();
  }
  const modsPath = path.join(discoveryPath, DATAPATH, 'VortexMods');

  return context.api.awaitUI()
    .then(() => fs.ensureDirWritableAsync(modsPath))
    .then(() => context.api.emitAndAwait('purge-mods-in-path', GAME_ID, '', modsPath));
}
