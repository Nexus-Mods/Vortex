import { IExtensionApi, IDeployedFile } from '../../../types/IExtensionContext';
import { IGame } from '../../../types/IGame';
import { INotification } from '../../../types/INotification';
import { ProcessCanceled } from '../../../util/CustomErrors';
import { log } from '../../../util/log';
import { activeGameId, currentGameDiscovery, activeProfile } from '../../../util/selectors';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import { getGame } from '../../gamemode_management/util/getGame';
import { installPath } from '../selectors';
import { IMod } from '../types/IMod';
import { loadActivation, saveActivation, withActivationLock } from './activationStore';
import { getCurrentActivator } from './deploymentMethods';
import { NoDeployment } from './exceptions';
import { dealWithExternalChanges } from './externalChanges';

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
  const profile = activeProfile(state);
  const gameId = profile.gameId;
  const gameDiscovery = currentGameDiscovery(state);
  const t = api.translate;
  const activator = getCurrentActivator(state, gameId, false);

  if (activator === undefined) {
    return Promise.reject(new NoDeployment());
  }

  if (Object.keys(getSafe(state, ['session', 'base', 'toolsRunning'], []).length > 0)) {
    api.sendNotification({
      type: 'info',
      id: 'purge-not-possible',
      message: 'Can\'t purge while the game or a tool is running',
      displayMS: 5000,
    });
    return Promise.resolve();
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
    log('debug', 'purging mods', { activatorId: activator.id, stagingPath });
    notification.message = t('Purging mods');
    api.sendNotification(notification);

    let lastDeployment: { [typeId: string]: IDeployedFile[] };

    return activator.prePurge(stagingPath)
      // load previous deployments
      .then(() => Promise.reduce(modTypes, (prev, typeId) =>
        loadActivation(api, typeId, modPaths[typeId], stagingPath, activator)
          .then(deployment => {
            prev[typeId] = deployment;
            return prev;
          }), {})
        .then(deployments => { lastDeployment = deployments; }))
      // deal with all external changes
      .then(() => dealWithExternalChanges(api, activator, profile.id, stagingPath, modPaths, lastDeployment))
      // purge all mod types
      .then(() => Promise.map(modTypes, typeId => activator.purge(stagingPath, modPaths[typeId])))
      // save (empty) activation
      .then(() => Promise.map(modTypes, typeId => saveActivation(typeId, state.app.instanceId, modPaths[typeId], stagingPath, [], activator.id)))
      .catch(ProcessCanceled, () => null)
      .then(() => Promise.resolve())
      .finally(() => activator.postPurge())
  }, true)
    .then(() => null)
    .finally(() => {
      api.dismissNotification(notification.id);
    });
}

