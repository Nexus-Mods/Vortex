import { IExtensionApi } from '../../../types/IExtensionContext';
import { IGame } from '../../../types/IGame';
import { INotification } from '../../../types/INotification';
import { ProcessCanceled } from '../../../util/CustomErrors';
import * as fs from '../../../util/fs';
import { activeGameId, currentGameDiscovery } from '../../../util/selectors';
import { truthy } from '../../../util/util';
import { getGame } from '../../gamemode_management/util/getGame';
import { installPath } from '../selectors';
import { IMod } from '../types/IMod';
import { loadActivation, saveActivation, withActivationLock } from './activationStore';
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

  const notification: INotification = {
    type: 'activity',
    message: t('Waiting for other operations to complete'),
    title: t('Purging'),
  };

  notification.id = api.sendNotification(notification);

  const game: IGame = getGame(gameId);
  const modPaths = game.getModPaths(gameDiscovery.path);

  const modTypes = Object.keys(modPaths).filter(typeId => truthy(modPaths[typeId]));

  return withActivationLock(() => {
    notification.message = t('Purging mods');
    api.sendNotification(notification);
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
    .finally(() => activator.postPurge())
  }, true)
    .then(() => null)
    .finally(() => {
      api.dismissNotification(notification.id);
    });
}

