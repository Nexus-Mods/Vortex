import { IExtensionApi } from '../../../types/IExtensionContext';
import { IGame } from '../../../types/IGame';
import { getCurrentActivator, getGame } from '../../../util/api';
import { activeGameId, currentGameDiscovery } from '../../../util/selectors';
import { installPath } from '../selectors';
import { loadActivation, saveActivation } from './activationStore';
import { NoDeployment } from './exceptions';

import * as Promise from 'bluebird';
import { IMod } from '../types/IMod';

export function genSubDirFunc(game: IGame): (mod: IMod) => string {
  if (typeof(game.mergeMods) === 'boolean') {
    return game.mergeMods
      ? () => ''
      : (mod: IMod) => mod.id;
  } else {
    return game.mergeMods;
  }
}

export function purgeMods(api: IExtensionApi): Promise<void> {
  const state = api.store.getState();
  const instPath = installPath(state);
  const gameId = activeGameId(state);
  const gameDiscovery = currentGameDiscovery(state);
  const t = api.translate;
  const activator = getCurrentActivator(state, gameId, false);

  if (activator === undefined) {
    return Promise.reject(new NoDeployment());
  }

  const notificationId = api.sendNotification({
    type: 'activity',
    message: t('Purging mods'),
    title: t('Purging'),
  });

  const game: IGame = getGame(gameId);
  const modPaths = game.getModPaths(gameDiscovery.path);

  return activator.prePurge(instPath)
    .then(() => Promise.each(Object.keys(modPaths), typeId =>
    loadActivation(api, typeId, modPaths[typeId], activator)
      .then(() => activator.purge(instPath, modPaths[typeId]))
      .then(() => saveActivation(typeId, state.app.instanceId,
                                 modPaths[typeId], [], activator.id))))
    .then(() => Promise.resolve())
  .finally(() => {
    api.dismissNotification(notificationId);
    return activator.postPurge();
  });
}

