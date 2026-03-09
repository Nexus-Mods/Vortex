import path from 'path';
import semver from 'semver';
import { actions, fs, selectors, types, util } from 'vortex-api';

import { GAME_ID, I18N_NAMESPACE, loadOrderFilePath, modsRelPath } from './common';
import { serialize } from './loadOrder';
import { LoadOrder } from './types';

export function migrate020(api, oldVersion): Promise<void> {
  if (semver.gte(oldVersion, '0.2.0')) {
    return Promise.resolve();
  }

  const state = api.store.getState();
  const mods = util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const hasMods = Object.keys(mods).length > 0;

  if (!hasMods) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    return api.sendNotification({
      id: '7dtd-requires-upgrade',
      type: 'warning',
      message: api.translate('Mods for 7 Days to Die need to be reinstalled',
        { ns: I18N_NAMESPACE }),
      noDismiss: true,
      actions: [
        {
          title: 'Explain',
          action: () => {
            api.showDialog('info', '7 Days to Die', {
              text: 'In version 17 of the game 7 Days to Die the way mods are installed '
                  + 'has changed considerably. Unfortunately we are now not able to support '
                  + 'this change with the way mods were previously installed.\n'
                  + 'This means that for the mods to work correctly you have to reinstall '
                  + 'them.\n'
                  + 'We are sorry for the inconvenience.',
            }, [
              { label: 'Close' },
            ]);
          },
        },
        {
          title: 'Understood',
          action: dismiss => {
            dismiss();
            resolve(undefined);
          },
        },
      ],
    });
  });
}

export async function migrate100(context, oldVersion): Promise<void> {
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
    // No mods - no problem.
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
    await serialize(context, loMap[profileId], undefined, profileId);
  }

  const modsPath = path.join(discoveryPath, modsRelPath());
  return context.api.awaitUI()
    .then(() => fs.ensureDirWritableAsync(modsPath))
    .then(() => context.api.emitAndAwait('purge-mods-in-path', GAME_ID, '', modsPath))
    .then(() => context.api.store.dispatch(actions.setDeploymentNecessary(GAME_ID, true)));
}

export async function migrate1011(context, oldVersion): Promise<void> {
  if (semver.gte(oldVersion, '1.0.11')) {
    return Promise.resolve();
  }

  const state = context.api.store.getState();
  const discoveryPath = util.getSafe(state,
    ['settings', 'gameMode', 'discovered', GAME_ID, 'path'], undefined);
  if (!discoveryPath) {
    return Promise.resolve();
  }

  const mods: { [modId: string]: types.IMod } = util.getSafe(state,
    ['persistent', 'mods', GAME_ID], {});

  if (Object.keys(mods).length === 0) {
    // No mods - no problem.
    return Promise.resolve();
  }

  const profiles = util.getSafe(state, ['persistent', 'profiles'], {});
  const loProfiles = Object.keys(profiles).filter(id => profiles[id]?.gameId === GAME_ID);
  const loMap: { [profId: string]: LoadOrder } = loProfiles.reduce((accum, iter) => {
    const lo: LoadOrder = util.getSafe(state, ['persistent', 'loadOrder', iter], []);
    accum[iter] = lo;
    return accum;
  }, {});

  for (const profileId of Object.keys(loMap)) {
    try {
      await serialize(context, loMap[profileId], undefined, profileId);
      // Not a bit deal if we fail to remove the loFile from the old location.
      await fs.removeAsync(path.join(discoveryPath, `${profileId}_loadOrder.json`)).catch(err => null);
    } catch (err) {
      return Promise.reject(new Error(`Failed to migrate load order for ${profileId}: ${err}`));
    }
  }

  const modsPath = path.join(discoveryPath, modsRelPath());
  return context.api.awaitUI()
    .then(() => fs.ensureDirWritableAsync(modsPath))
    .then(() => context.api.emitAndAwait('purge-mods-in-path', GAME_ID, '', modsPath))
    .then(() => context.api.store.dispatch(actions.setDeploymentNecessary(GAME_ID, true)));
}
