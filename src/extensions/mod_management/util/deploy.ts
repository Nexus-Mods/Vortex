import { startActivity, stopActivity } from '../../../actions/session';
import { setPurgeSummary, setPurgeSummaryVisible } from '../actions/session';
import { IDeployedFile, IDeploymentMethod, IExtensionApi } from '../../../types/IExtensionContext';
import { IGame } from '../../../types/IGame';
import { INotification } from '../../../types/INotification';
import { IProfile } from '../../../types/IState';
import { ProcessCanceled, TemporaryError } from '../../../util/CustomErrors';
import { log } from '../../../util/log';
import { activeProfile } from '../../../extensions/profile_management/activeGameId';
import { profileById } from '../../../extensions/profile_management/selectors';
import { lastActiveProfileForGame } from '../../../extensions/profile_management/activeGameId';
import { discoveryByGame } from '../../../extensions/gamemode_management/selectors';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import { IModType } from '../../gamemode_management/types/IModType';
import { getGame } from '../../gamemode_management/util/getGame';
import { installPath, installPathForGame } from '../selectors';
import { IMod } from '../types/IMod';
import { fallbackPurgeType, getManifest, loadActivation, saveActivation, withActivationLock } from './activationStore';
import { getActivator, getCurrentActivator } from './deploymentMethods';
import { NoDeployment } from './exceptions';
import { dealWithExternalChanges } from './externalChanges';

// TODO: Remove Bluebird import - using native Promise;
import { promiseFilter, promiseMap, promiseMapSeries, promiseReduce } from '../../../util/bluebird-migration-helpers.local';
import { generate as shortid } from 'shortid';

const MERGE_SUBDIR = 'zzz_merge';

export function genSubDirFunc(game: IGame, modType: IModType): (mod: IMod) => string {
  const mergeModsOpt = (modType !== undefined) && (modType.options.mergeMods !== undefined)
    ? modType.options.mergeMods
    : game.mergeMods;

  if (typeof(mergeModsOpt) === 'boolean') {
    return mergeModsOpt
      ? () => ''
      : (mod: IMod) => mod !== null ? mod.id : MERGE_SUBDIR;
  } else {
    return (mod: IMod) => {
      try {
        return mergeModsOpt(mod);
      } catch (err) {
        // if the game doesn't implement generating a output path for the merge,
        // use the default
        if (mod === null) {
          return MERGE_SUBDIR;
        } else {
          throw err;
        }
      }
    };
  }
}

function filterManifest(activator: IDeploymentMethod,
                        deployPath: string,
                        stagingPath: string,
                        deployment: IDeployedFile[]): Promise<IDeployedFile[]> {
  return promiseFilter(deployment, file =>
    activator.isDeployed(stagingPath, deployPath, file));
}

export function loadAllManifests(api: IExtensionApi,
                                 deploymentMethod: IDeploymentMethod,
                                 gameId: string,
                                 modPaths: { [typeId: string]: string },
                                 stagingPath: string) {
  const modTypes = Object.keys(modPaths).filter(typeId => truthy(modPaths[typeId]));

  return promiseReduce(modTypes, (prev, typeId) =>
    loadActivation(api, gameId, typeId, modPaths[typeId], stagingPath, deploymentMethod)
      .then(deployment => {
        prev[typeId] = deployment;
        return prev;
      }), {});
}

export function purgeMods(api: IExtensionApi,
                          gameId?: string,
                          isUnmanaging?: boolean): Promise<void> {
  const state = api.store.getState();
  let profile = gameId !== undefined
    ? profileById(state, lastActiveProfileForGame(state, gameId))
    : activeProfile(state);

  if (isUnmanaging && profile === undefined) {
    // This block intends to cater for a use case where the user is attempting
    //  to unmanage his game but has removed the last active profile manually
    //  through the profiles page. The user most definitely still has profiles
    //  for the game as the game entry gets removed if all have been deleted.
    // Given that the user is attempting to unmanage his game, we do not want
    //  to block him from purging the mods. Any profile will do.
    const profiles: { [profileId: string]: IProfile } =
      getSafe(state, ['persistent', 'profiles'], {});

    const profileId = Object.keys(profiles)
      .filter(id => profiles[id].gameId === gameId)
      .pop();

    profile = profiles?.[profileId];
  }

  if (profile === undefined) {
    return Promise.reject(new TemporaryError('No active profile'));
  }

  return getManifest(api, '', gameId)
    .then(manifest => {
      if (manifest?.deploymentMethod !== undefined) {
        log('info', 'using deployment method from manifest',
            { method: manifest?.deploymentMethod });
        const deployedActivator = getActivator(manifest?.deploymentMethod);
        return purgeModsImpl(api, deployedActivator, profile);
      } else {
        return purgeModsImpl(api, undefined, profile)
          .catch(err => {
            // If the user is unmanaging the game and the purge was unable to find any
            //  of the game's mods path during the purge, that suggests that the user
            //  has uninstalled the game and is trying to "unmanage" the game.
            if (['ENOENT'].includes(err.code) && isUnmanaging) {
              const game = getGame(gameId);
              const discovery = getSafe(state,
                                        ['settings', 'gameMode', 'discovered', gameId], undefined);
              if ((game === undefined) || (discovery?.path === undefined)) {
                return Promise.reject(err);
              }
              const modTypePaths = game.getModPaths(discovery.path);
              const modPaths = Object.keys(modTypePaths).map(modType => modTypePaths[modType]);
              if (modPaths.includes(err.path)) {
                // This confirms it - the mods folder is missing - user removed it.
                //  In this case we still want to allow the removal.
                return Promise.resolve();
              }
            } else {
              return Promise.reject(err);
            }
          });
      }
    });
}

function purgeModsImpl(api: IExtensionApi, activator: IDeploymentMethod,
                       profile: IProfile): Promise<void> {
  const state = api.store.getState();
  const { gameId } = profile;
  const stagingPath = installPathForGame(state, gameId);
  const gameDiscovery = discoveryByGame(state, gameId);

  if (gameDiscovery?.path === undefined) {
    api.sendNotification({
      type: 'info',
      id: 'purge-not-possible',
      message: 'Can\'t purge because game is not discovered',
      displayMS: 5000,
    });
    return Promise.resolve();
  }

  log('info', 'current deployment method is',
      { method: getCurrentActivator(state, gameId, false)?.id });
  if (activator === undefined) {
    activator = getCurrentActivator(state, gameId, false);
  }

  if ((activator === undefined) || (stagingPath === undefined)) {
    // throwing this exception on stagingPath === undefined isn't exactly
    // accurate but the effect is the same: User has to activate the game
    // and review settings before deployment is possible
    return Promise.reject(new NoDeployment());
  }

  if (Object.keys(getSafe(state, ['session', 'base', 'toolsRunning'], {})).length > 0) {
    api.sendNotification({
      type: 'info',
      id: 'purge-not-possible',
      message: 'Can\'t purge while the game or a tool is running',
      displayMS: 5000,
    });
    return Promise.resolve();
  }

  const notificationId: string = shortid();

  const onProgress = (progress: number, message: string) => {
    api.sendNotification({
      id: notificationId,
      type: 'activity',
      title: 'Purging',
      message,
      progress,
    });
  };

  onProgress(0, 'Waiting for other operations to complete');

  const game: IGame = getGame(gameId);
  const modPaths = game.getModPaths(gameDiscovery.path);

  const modTypes = Object.keys(modPaths).filter(typeId => truthy(modPaths[typeId]));

  return withActivationLock(() => {
    log('debug', 'purging mods', { activatorId: activator.id, stagingPath });
    onProgress(0, 'Preparing purge');

    let lastDeployment: { [typeId: string]: IDeployedFile[] };
    let purgeSummary: { gameId: string, activatorId: string, byType: { [typeId: string]: any[] } };
    api.store.dispatch(startActivity('mods', 'purging'));

    // TODO: we really should be using the deployment specified in the manifest,
    //   not the current one! This only works because we force a purge when switching
    //   deployment method.
    return activator.prePurge(stagingPath)
      // load previous deployments
      .then(() => loadAllManifests(api, activator, gameId, modPaths, stagingPath)
        .then(deployments => { lastDeployment = deployments; }))
      .then(() => api.emitAndAwait('will-purge', profile.id, lastDeployment))
      .then(() => {
        onProgress(10, 'Removing links');
        return Promise.resolve();
      })
      // deal with all external changes
      .then(() => dealWithExternalChanges(api, activator, profile.id, stagingPath,
                                          modPaths, lastDeployment))
      .then(() => {
        onProgress(25, 'Removing links');
        return Promise.resolve();
      })
      // purge all mod types
      .then(() => promiseMapSeries(modTypes, (typeId: string, idx: number) => {
        // calculating progress for the actual file removal is a bit awkward, we get the idx
        // and total for each mod type separately. The total removal progress should cover 50%
        // of our progress bar, each mod type is then a fraction of that.
        const cover = 50 / modTypes.length;
        const progressType  = (num: number, total: number) => {
          onProgress(25 + (idx * cover) + Math.floor((num * cover) / total), 'Removing links');
        };
        return activator.purge(stagingPath, modPaths[typeId], gameId, progressType);
      }))
      .then(() => {
        onProgress(75, 'Saving updated manifest');
        return Promise.resolve();
      })
      // save (empty) activation
      .then(() => promiseMap(modTypes, typeId =>
        saveActivation(gameId, typeId, state.app.instanceId, modPaths[typeId], stagingPath,
                       [], activator.id)))
      // the deployment may be changed so on an exception we still need to update it
      .catch((err) => {
        if (lastDeployment === undefined) {
          // exception happened before the deployment is even loaded so there is nothing
          // to clean up
          return Promise.reject(err);
        }
        return promiseMap(modTypes, typeId =>
          filterManifest(activator, modPaths[typeId], stagingPath, lastDeployment[typeId])
            .then(files =>
              saveActivation(gameId, typeId, state.app.instanceId, modPaths[typeId], stagingPath,
                             files, activator.id)))
          .then(() => Promise.reject(err));
      })
      .catch(err => { if (err instanceof ProcessCanceled) { return Promise.resolve(null); } else { return Promise.reject(err); }})
      .then(() => Promise.resolve())
      .then(() => {
        onProgress(85, 'Post purge events');
        return Promise.resolve();
      })
      .finally(() => activator.postPurge())
      .then(() => {
        // Build summary based on previous activation data
        purgeSummary = {
          gameId,
          activatorId: activator.id,
          byType: {},
        };
        for (const typeId of modTypes) {
          purgeSummary.byType[typeId] = lastDeployment?.[typeId] ?? [];
        }
        return api.emitAndAwait('did-purge', profile.id)
          .then(() => {
            api.store.dispatch(setPurgeSummary(purgeSummary));
            api.store.dispatch(setPurgeSummaryVisible(true));
          });
      });
  }, true)
    .then(() => null)
    .finally(() => {
      api.dismissNotification(notificationId);
      api.store.dispatch(stopActivity('mods', 'purging'));
    });
}

export function purgeModsInPath(api: IExtensionApi, gameId: string, typeId: string,
                                modPath: string): Promise<void> {
  const state = api.store.getState();
  const profile: IProfile = (gameId !== undefined)
    ? profileById(state, lastActiveProfileForGame(state, gameId))
    : activeProfile(state);

  if (gameId === undefined) {
    gameId = profile.gameId;
  }
  const stagingPath = installPathForGame(state, gameId);

  const t = api.translate;
  const activator = getCurrentActivator(state, gameId, false);

  if (activator === undefined) {
    return Promise.reject(new NoDeployment());
  }

  if (Object.keys(getSafe(state, ['session', 'base', 'toolsRunning'], {})).length > 0) {
    api.sendNotification({
      type: 'info',
      id: 'purge-not-possible',
      message: 'Can\'t purge while the game or a tool is running',
      displayMS: 5000,
    });
    return Promise.resolve();
  }

  const notificationId: string = shortid();

  const onProgress = (progress: number, message: string) => {
    api.sendNotification({
      id: notificationId,
      type: 'activity',
      title: 'Purging',
      message,
      progress,
    });
  };

  onProgress(0, 'Waiting for other operations to complete');

  return withActivationLock(() => {
    log('debug', 'purging mods', { activatorId: activator.id, stagingPath });
    onProgress(0, 'Preparing purge');

    if ((gameId !== undefined) && (profile === undefined)) {
      // gameId was set but we have no last active profile for that game.
      // In this case there is probably nothing to purge but if that's true
      // there will also be no manifest so we can just as easily try a fallback
      // purge just to be safe.
      return fallbackPurgeType(api, activator, gameId, typeId, modPath, stagingPath);
    }

    // TODO: we really should be using the deployment specified in the manifest,
    //   not the current one! This only works because we force a purge when switching
    //   deployment method.
    let lastDeployment: IDeployedFile[] = [];

    return activator.prePurge(stagingPath)
      .then(() => {
        onProgress(25, 'Removing links');
        return Promise.resolve();
      })
      // load previous deployment for this type
      .then(() => loadActivation(api, gameId, typeId, modPath, stagingPath, activator)
        .then(deployment => { lastDeployment = deployment; }))
      // purge the specified mod type
      .then(() => activator.purge(stagingPath, modPath, gameId))
      .then(() => {
        onProgress(50, 'Saving updated manifest');
        return Promise.resolve();
      })
      // save (empty) activation
      .then(() => saveActivation(gameId, typeId, state.app.instanceId, modPath, stagingPath,
                                 [], activator.id))
      .catch(err => { if (err instanceof ProcessCanceled) { return Promise.resolve(null); } else { return Promise.reject(err); }})
      .then(() => Promise.resolve())
      .finally(() => activator.postPurge())
      .then(() => {
        onProgress(75, 'Post purge events');
        return Promise.resolve();
      })
      .then(() => {
        const summary = {
          gameId,
          activatorId: activator.id,
          byType: { [typeId]: lastDeployment ?? [] },
        };
        return api.emitAndAwait('did-purge', profile.id)
          .then(() => {
            api.store.dispatch(setPurgeSummary(summary));
            api.store.dispatch(setPurgeSummaryVisible(true));
          });
      });
  }, true)
    .then(() => null)
    .finally(() => {
      api.dismissNotification(notificationId);
    });
}
