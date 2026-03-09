import path from 'path';
import semver from 'semver';
import { actions, fs, log, selectors, types, util } from 'vortex-api';

import { GAME_ID, modsRelPath } from './common';

const oldModRelPath = path.join('BloodstainedRotN', 'Content', 'Paks', '~mod');

export async function migrate100(api: types.IExtensionApi, oldVersion: string) {
  if (semver.gte(oldVersion || '0.0.1', '1.0.0')) {
    return Promise.resolve();
  }

  const state = api.store.getState();
  const activatorId = selectors.activatorForGame(state, GAME_ID);
  const activator = util.getActivator(activatorId);

  const discovery =
    util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID], undefined);

  if ((discovery === undefined)
      || (discovery.path === undefined)
      || (activator === undefined)) {
    // if this game is not discovered or deployed there is no need to migrate
    log('debug', 'skipping bloodstained migration because no deployment set up for it');
    return Promise.resolve();
  }

  // would be good to inform the user beforehand but since this is run in the main process
  // and we can't currently show a (working) dialog from the main process it has to be
  // this way.
  return api.awaitUI()
    .then(() => fs.ensureDirWritableAsync(path.join(discovery.path, modsRelPath())))
    .then(() => api.emitAndAwait('purge-mods-in-path',
                                 GAME_ID,
                                 '',
                                 path.join(discovery.path, oldModRelPath)))
    .then(() => {
      api.store.dispatch(actions.setDeploymentNecessary(GAME_ID, true));
    });
}
