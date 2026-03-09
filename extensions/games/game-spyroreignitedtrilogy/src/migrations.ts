import path from 'path';
import semver from 'semver';
import { actions, fs, selectors, types, util } from 'vortex-api';
import { serialize } from './loadOrder';

import { GAME_ID, modsRelPath } from './common';
import { LoadOrder } from './types';

export async function migrate100(context, oldVersion) {
  if (semver.gte(oldVersion, '1.0.0')) {
    return Promise.resolve();
  }

  const state = context.api.store.getState();
  const discoveryPath = util.getSafe(state,
    ['settings', 'gameMode', 'discovered', GAME_ID, 'path'], undefined);
  const activatorId = selectors.activatorForGame(state, GAME_ID);
  const activator = util.getActivator(activatorId);
  if (discoveryPath === undefined || activator === undefined) {
    return Promise.resolve();
  }

  const mods: { [modId: string]: types.IMod } = util.getSafe(state,
    ['persistent', 'mods', GAME_ID], {});
  if (Object.keys(mods).length === 0) {
    return Promise.resolve();
  }

  const profiles = util.getSafe(state, ['persistent', 'profiles'], {});
  const loProfiles = Object.keys(profiles).filter(id => profiles[id]?.gameId === GAME_ID);
  const loMap: { [profId: string]: LoadOrder } = loProfiles.reduce((accum, iter) => {
    const current = util.getSafe(state, ['persistent', 'loadOrder', iter], []);
    const newLO: LoadOrder = current.map(entry => {
      return {
        enabled: true,
        name: (mods[entry] !== undefined)
          ? util.renderModName(mods[entry])
          : entry,
        id: entry,
        modId: entry,
      };
    });
    accum[iter] = newLO;
    return accum;
  }, {});

  for (const profileId of Object.keys(loMap)) {
    await serialize(context, loMap[profileId], profileId);
  }

  const modsPath = path.join(discoveryPath, modsRelPath());
  return context.api.awaitUI()
    .then(() => fs.ensureDirWritableAsync(modsPath))
    .then(() => context.api.emitAndAwait('purge-mods-in-path', GAME_ID, '', modsPath))
    .then(() => context.api.store.dispatch(actions.setDeploymentNecessary(GAME_ID, true)));
}
