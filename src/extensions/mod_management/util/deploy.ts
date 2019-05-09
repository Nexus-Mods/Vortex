import { IExtensionApi } from '../../../types/IExtensionContext';
import { IGame } from '../../../types/IGame';
import { ProcessCanceled } from '../../../util/CustomErrors';
import * as fs from '../../../util/fs';
import { activeGameId, currentGameDiscovery } from '../../../util/selectors';
import { truthy } from '../../../util/util';
import { getGame } from '../../gamemode_management/util/getGame';
import { installPath } from '../selectors';
import { IMod } from '../types/IMod';
import { loadActivation, saveActivation } from './activationStore';
import { getCurrentActivator } from './deploymentMethods';
import { NoDeployment } from './exceptions';

import * as Promise from 'bluebird';

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
  const stagingPath = installPath(state);
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

  const modTypes = Object.keys(modPaths).filter(typeId => truthy(modPaths[typeId]));

  return activator.prePurge(stagingPath)
    .then(() => Promise.each(modTypes, typeId =>
      fs.statAsync(modPaths[typeId])
      .catch({ code: 'ENOTFOUND' }, () =>
          Promise.reject(new ProcessCanceled('target directory missing')))
      .then(() => loadActivation(api, typeId, modPaths[typeId], stagingPath, activator))
      .then(() => activator.purge(stagingPath, modPaths[typeId]))
      .then(() => saveActivation(typeId, state.app.instanceId,
                                 modPaths[typeId], stagingPath, [], activator.id)))
      .catch(ProcessCanceled, () => null))
    .then(() => Promise.resolve())
  .finally(() => {
    api.dismissNotification(notificationId);
    return activator.postPurge();
  });
}

