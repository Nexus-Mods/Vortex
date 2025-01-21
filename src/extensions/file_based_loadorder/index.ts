/* eslint-disable */

import * as _ from 'lodash';

import * as path from 'path';

import { setFBForceUpdate, setValidationResult } from './actions/session';

import { IExtensionContext } from '../../types/IExtensionContext';
import {
  ILoadOrderGameInfo, ILoadOrderGameInfoExt, IValidationResult, LoadOrder,
  LoadOrderValidationError
} from './types/types';

import { ICollection } from './types/collections';

import { generate, Interface, parser } from './collections/loadOrder';

import FileBasedLoadOrderPage from './views/FileBasedLoadOrderPage';

import { modLoadOrderReducer } from './reducers/loadOrder';
import { sessionReducer } from './reducers/session';

import * as types from '../../types/api';
import * as util from '../../util/api';
import * as selectors from '../../util/selectors';

import { log } from '../../util/log';
import { setFBLoadOrder } from './actions/loadOrder';

import { setFBLoadOrderRedundancy } from './actions/session';

import { addGameEntry, findGameEntry } from './gameSupport';
import { assertValidationResult, errorHandler } from './util';

import * as fs from '../../util/fs';

import UpdateSet, { ILoadOrderEntryExt } from './UpdateSet';

interface IDeployment {
  [modType: string]: types.IDeployedFile[];
}

interface IProfileState {
  [id: string]: types.IProfile;
}

async function genToolsRunning(api: types.IExtensionApi, prev: any, current: any) {
  if (Object.keys(current).length === 0) {
    // User has finished using a tool/game ensure we refresh our load order
    //  just in case he changed the LO inside that tool/game.
    const state = api.store.getState();
    const profile = selectors.activeProfile(state);
    if (profile?.gameId === undefined) {
      // Profiles changed with no active profile.
      //  Maybe it was changed by an extension ?
      return;
    }

    const gameEntry = findGameEntry(profile.gameId);
    if (gameEntry === undefined) {
      // This game wasn't registered with the LO component. That's fine
      //  probably just a game that doesn't need LO support.
      return;
    }

    try {
      const currentLO: LoadOrder = await gameEntry.deserializeLoadOrder();
      api.store.dispatch(setFBLoadOrder(profile.id, currentLO));
    } catch (err) {
      // nop - any errors would've been reported by applyNewLoadOrder.
    }
  }

  return;
}

async function genLoadOrderChange(api: types.IExtensionApi, oldState: any, newState: any) {
  const state = api.store.getState();
  const profile = selectors.activeProfile(state);
  if (profile?.gameId === undefined) {
    // Profiles changed with no active profile.
    //  Maybe it was changed by an extension ?
    return;
  }

  const gameEntry = findGameEntry(profile.gameId);
  if (gameEntry === undefined) {
    // This game wasn't registered with the LO component. That's fine
    //  probably just a game that doesn't need LO support.
    return;
  }

  if ((state.session.base.activity?.installing_dependencies ?? []).length > 0) {
    // Don't do anything if we're in the middle of installing deps
    log('info', 'skipping load order serialization/deserialization');
    return;
  }

  if (newState[profile.id] === undefined) {
    // Profile removed.
    return;
  }

  const prevLO: LoadOrder = (oldState[profile.id] !== undefined)
    ? oldState[profile.id] : [];

  if (JSON.stringify(oldState[profile.id]) !== JSON.stringify(newState[profile.id])) {
    let loadOrder: LoadOrder = newState[profile.id] ?? [];
    if (updateSet.isInitialized()) {
      loadOrder = updateSet.restore(loadOrder);
    } else {
      // If we don't have an update set, we can't restore the load order, but rather than
      //  throwing an exception here and ruining the user's day, we'll just log a debug message.
      log('debug', 'update set is not initialized!', 'updating/re-installing mods will not recover their indexes');
    }
    try {
      // This is the only place where we want applyNewLoadOrder to be called
      //  as we've detected a change in the load order.
      await applyNewLoadOrder(api, profile, prevLO, loadOrder);
    } catch (err) {
      // nop - any errors would've been reported by applyNewLoadOrder.
    }
  }
}

async function genProfilesChange(api: types.IExtensionApi,
                                 oldState: IProfileState,
                                 newState: IProfileState) {
  const state = api.store.getState();
  if ((state.session.base.activity?.installing_dependencies ?? []).length > 0) {
    // Don't do anything if we're in the middle of installing deps
    log('info', 'skipping load order serialization/deserialization');
    return;
  }
  const profile = selectors.activeProfile(state);
  if (profile?.gameId === undefined) {
    // Profiles changed with no active profile.
    //  Maybe it was changed by an extension ?
    return;
  }

  const gameEntry = findGameEntry(profile.gameId);
  if (gameEntry === undefined) {
    // This game wasn't registered with the LO component. That's fine
    //  probably just a game that doesn't need LO support.
    return;
  }

  if (newState[profile.id] === undefined) {
    // Profile removed.
    return;
  }

  try {
    const loadOrder: LoadOrder = await gameEntry.deserializeLoadOrder();
    api.store.dispatch(setFBLoadOrder(profile.id, loadOrder));
  } catch (err) {
    // nop - any errors would've been reported by applyNewLoadOrder.
  }
}

async function genDeploymentEvent(api: types.IExtensionApi, profileId: string, loadOrderRedundancy?: LoadOrder) {
  // Yes - this gets executed on purge too (at least for now).
  const state = api.store.getState();
  const profile = selectors.profileById(state, profileId);
  if (profile?.gameId === undefined) {
    // I guess it's theoretically possible for the deployment
    //  event to be queued and by the time we execute this piece of
    //  logic, the user may have removed the profile.
    log('warn', 'invalid profile id', profileId);
    return;
  }

  const gameEntry: ILoadOrderGameInfo = findGameEntry(profile.gameId);
  if (gameEntry === undefined) {
    // Game does not require LO.
    return;
  }

  try {
    const deserializedLO: LoadOrder = [] = await gameEntry.deserializeLoadOrder();
    if (loadOrderRedundancy !== undefined && JSON.stringify(deserializedLO) !== JSON.stringify(loadOrderRedundancy)) {
      const batchedActions = [
        setFBLoadOrderRedundancy(profile.id, []),
        setFBLoadOrder(profile.id, loadOrderRedundancy),
      ];
      util.batchDispatch(api.store, batchedActions);
    } else {
      api.store.dispatch(setFBLoadOrder(profile.id, deserializedLO));
    }
  } catch (err) {
    // nop - any errors would've been reported by applyNewLoadOrder.
  }
}

async function applyNewLoadOrder(api: types.IExtensionApi,
                                 profile: types.IProfile,
                                 prev: LoadOrder,
                                 newLO: LoadOrder): Promise<void> {
  // This function is intended to execute as a reaction to a change
  //  in LO - never call the setNewLoadOrder state action in here unless
  //  you have a fetish for infinite loops.
  const gameEntry = findGameEntry(profile.gameId);
  if (gameEntry === undefined || profile === undefined) {
    // How ?
    if (gameEntry === undefined) {
      log('warn', 'unable to apply new load order', `${profile.gameId} is not registered with LoadOrder component`);
    } else {
      log('warn', 'unable to apply new load order', `profile ${profile.id} does not exist`);
    }
    return;
  }

  try {
    const validRes: IValidationResult = await gameEntry.validate(prev, newLO);
    assertValidationResult(validRes);
    if (validRes !== undefined) {
      throw new LoadOrderValidationError(validRes, newLO);
    }

    api.store.dispatch(setValidationResult(profile.id, undefined));
    await gameEntry.serializeLoadOrder(newLO, prev);
  } catch (err) {
    return errorHandler(api, gameEntry.gameId, err);
  } finally {
    // After serialization (even when failed), depending on the game extension,
    //  we may need to force an update as the serialization function may have
    //  changed the load order in some way.
    api.store.dispatch(setFBForceUpdate(profile.id));
  }

  return;
}

function genDidDeploy(api: types.IExtensionApi) {
  return async (profileId: string, deployment: IDeployment) => {
    const state = api.getState();
    if ((state.session.base.activity?.installing_dependencies ?? []).length > 0) {
      // Don't do anything if we're in the middle of installing deps
      log('info', 'skipping load order serialization/deserialization');
      return Promise.resolve();
    }
    const gameId = selectors.profileById(api.getState(), profileId)?.gameId;
    const gameEntry: ILoadOrderGameInfo = findGameEntry(gameId);
    const savedLO = util.getSafe(api.store.getState(), ['session', 'fblo', 'loadOrder', profileId], []);
    const redundancy = (gameEntry?.clearStateOnPurge === false && savedLO.length > 0)
      ? util.getSafe(api.store.getState(), ['session', 'fblo', 'loadOrder', profileId], [])
      : undefined;
    await genDeploymentEvent(api, profileId, redundancy);
  }
}

function genWillPurge(api: types.IExtensionApi) {
  return async (profileId: string, deployment: IDeployment) => {
    const gameId = selectors.profileById(api.getState(), profileId)?.gameId;
    const gameEntry: ILoadOrderGameInfo = findGameEntry(gameId);
    if (gameEntry?.clearStateOnPurge === false) {
      const state = api.getState();
      const currentLO = util.getSafe(state, ['persistent', 'loadOrder', profileId], []);
      api.store.dispatch(setFBLoadOrderRedundancy(profileId, currentLO));
    }
    return Promise.resolve();
  }
}

function genDidPurge(api: types.IExtensionApi) {
  return async (profileId: string, deployment: IDeployment) => genDeploymentEvent(api, profileId);
}

let updateSet: UpdateSet;
export default function init(context: IExtensionContext) {
  context.registerReducer(['persistent', 'loadOrder'], modLoadOrderReducer);
  context.registerReducer(['session', 'fblo'], sessionReducer);

  const setOrder = async (profileId: string, loadOrder: types.LoadOrder, refresh?: boolean) => {
    const profile = selectors.profileById(context.api.getState(), profileId);
    if (!refresh) {
      // Anything that isn't a refresh is a user action.
      //  The Update set has to be re-initialized with the new load order.
      updateSet.init(profile.gameId, loadOrder.map((lo, idx) => ({ ...lo, index: idx })));
    }
    context.api.store.dispatch(setFBLoadOrder(profileId, loadOrder));
  }
  context.registerMainPage('sort-none', 'Load Order', FileBasedLoadOrderPage, {
    id: 'file-based-loadorder',
    hotkey: 'E',
    group: 'per-game',
    visible: () => {
      const currentGameId: string = selectors.activeGameId(context.api.store.getState());
      const gameEntry: ILoadOrderGameInfo = findGameEntry(currentGameId);
      return (gameEntry?.condition !== undefined) ? gameEntry.condition() : gameEntry !== undefined;
    },
    priority: 120,
    props: () => {
      return {
        getGameEntry: findGameEntry,
        onImportList: async () => {
          const api = context.api;
          const file = await api.selectFile({ filters: [{ name: 'JSON', extensions: ['json'] }], title: 'Import Load Order' });
          if (!file) {
            return;
          }
          try {
            const fileData = await fs.readFileAsync(file, { encoding: 'utf8' });
            const loData: LoadOrder = JSON.parse(fileData);
            if (!Array.isArray(loData)) {
              throw new Error('invalid load order data');
            }
            updateSet.init(selectors.activeGameId(api.getState()), loData.map((lo, idx) => ({ ...lo, index: idx })));
            const profileId = selectors.activeProfile(api.getState()).id;
            context.api.store.dispatch(setFBLoadOrder(profileId, loData));
            api.sendNotification({ type: 'success', message: 'Load order imported', id: 'import-load-order' });
          } catch (err) {
            api.showErrorNotification('Failed to import load order', err, { allowReport: false });
          }
        },
        onExportList: async () => {
          const api = context.api;
          const state = api.getState();
          const profileId = selectors.activeProfile(state).id;
          const loadOrder = util.getSafe(state, ['persistent', 'loadOrder', profileId], []);
          const data = JSON.stringify(loadOrder, null, 2);
          const loPath = await api.saveFile({ defaultPath: 'loadorder.json', filters: [{ name: 'JSON', extensions: ['json'] }], title: 'Export Load Order' });
          if (loPath) {
            try {
              await fs.ensureDirWritableAsync(path.basename(loPath));
              await fs.writeFileAsync(loPath, data);
              api.sendNotification({ type: 'success', message: 'Load order exported', id: 'export-load-order' });
            } catch (err) {
              api.showErrorNotification('Failed to export load order', err, { allowReport: false });
            }
          }
        },
        validateLoadOrder: (profile: types.IProfile, loadOrder: LoadOrder) =>
          validateLoadOrder(context.api, profile, loadOrder),
        onSetOrder: setOrder,
        onStartUp: (gameId: string) => onStartUp(context.api, gameId),
        onShowError: (gameId: string, error: Error) => errorHandler(context.api, gameId, error),
      };
    },
  });

  context.registerLoadOrder = ((gameInfo: ILoadOrderGameInfo, extPath: string) => {
    addGameEntry(gameInfo, extPath);
  }) as any;

  context.optional.registerCollectionFeature(
    'file_based_load_order_collection_data',
    (gameId: string, includedMods: string[]) => {
      const state = context.api.getState();
      const stagingPath = selectors.installPathForGame(state, gameId);
      const mods: { [modId: string]: types.IMod } =
        util.getSafe(state, ['persistent', 'mods', gameId], {});
      return generate(context.api, state, gameId, stagingPath, includedMods, mods);
    },
    (gameId: string, collection: ICollection) => parser(context.api, gameId, collection, updateSet),
    () => Promise.resolve(),
    (t) => t('Load Order'),
    (state: types.IState, gameId: string) => {
      const gameEntry: ILoadOrderGameInfoExt = findGameEntry(gameId);
      if (gameEntry === undefined) {
        return false;
      }
      return !(gameEntry.noCollectionGeneration ?? false);
    },
    Interface,
  );

  context.registerActionCheck('SET_FB_LOAD_ORDER', (state, action: any) => {
      const { profileId, loadOrder } = action.payload;
      if (!loadOrder || !Array.isArray(loadOrder)) {
        log('error', 'invalid load order', loadOrder);
      }
      const profile = selectors.profileById(state, profileId);
      const gameId = profile?.gameId ?? selectors.activeGameId(state);
      if (updateSet && gameId) {
        updateSet.init(gameId, (loadOrder ?? []).map((lo, idx) => ({ ...lo, index: idx })));
      }
      return undefined;
    });

  context.once(() => {
    updateSet = new UpdateSet(context.api, (gameId: string) => {
      const gameEntry: ILoadOrderGameInfo = findGameEntry(gameId);
      return gameEntry !== undefined;
    });
    context.api.onStateChange(['session', 'base', 'toolsRunning'],
      (prev, current) => genToolsRunning(context.api, prev, current));

    context.api.onStateChange(['persistent', 'loadOrder'],
      (prev, current) => genLoadOrderChange(context.api, prev, current));

    context.api.onStateChange(['persistent', 'profiles'],
      (prev, current) => genProfilesChange(context.api, prev, current));

    context.api.events.on('gamemode-activated', (gameId: string) => onGameModeActivated(context.api, gameId));

    context.api.onAsync('did-deploy', genDidDeploy(context.api));
    context.api.onAsync('will-purge', genWillPurge(context.api));
    context.api.onAsync('did-purge', genDidPurge(context.api));

    context.api.onAsync('will-remove-mods', (gameId: string, modIds: string[], removeOpts: types.IRemoveModOptions) =>
      onWillRemoveMods(context.api, gameId, modIds, removeOpts));

    context.api.onAsync('will-remove-mod', (gameId: string, modId, removeOpts: types.IRemoveModOptions) =>
      onWillRemoveMods(context.api, gameId, [modId], removeOpts));
  });

  return true;
}

async function onGameModeActivated(api: types.IExtensionApi, gameId: string) {
  const gameEntry: ILoadOrderGameInfo = findGameEntry(gameId);
  if (gameEntry === undefined) {
    // Game does not require LO.
    return;
  }
  updateSet.init(gameId);
}

async function onWillRemoveMods(api: types.IExtensionApi,
                                gameId: string,
                                modIds: string[],
                                removeOpts: types.IRemoveModOptions): Promise<void> {
  const gameEntry: ILoadOrderGameInfo = findGameEntry(gameId);
  if (gameEntry === undefined) {
    // Game does not require LO.
    return;
  }
  if (removeOpts?.willBeReplaced === true) {
    const state = api.getState();
    const profileId = selectors.lastActiveProfileForGame(state, gameId);
    const loadOrder = util.getSafe(state, ['persistent', 'loadOrder', profileId], []);
    const filtered = loadOrder.reduce((acc, lo, idx) => {
      if (!modIds.includes(lo.modId)) {
        return acc;
      }
      const loEntryExt: ILoadOrderEntryExt = {
        ...lo,
        index: idx,
      }
      acc.push(loEntryExt);
      return acc;
    }, []);
    if (!updateSet.isInitialized()) {
      updateSet.init(gameId, filtered);
    } else {
      filtered.forEach(updateSet.addNumericModId);
    }
  }
  return Promise.resolve();
}

async function validateLoadOrder(api: types.IExtensionApi,
                                 profile: types.IProfile,
                                 loadOrder: LoadOrder): Promise<IValidationResult> {
  const state = api.getState();
  try {
    if (profile?.id === undefined) {
      log('error', 'failed to validate load order due to undefined profile', loadOrder);
      throw new util.DataInvalid('invalid profile');
    }
    const prevLO = util.getSafe(state, ['persistent', 'loadOrder', profile.id], []);
    const gameEntry: ILoadOrderGameInfo = findGameEntry(profile.gameId);
    if (gameEntry === undefined) {
      const details = (gameEntry === undefined)
        ? { gameId: profile.gameId }
        : { profileId: profile.id };
      log('error', 'invalid game entry', details);
      throw new util.DataInvalid('invalid game entry');
    }
    const validRes: IValidationResult = await gameEntry.validate(prevLO, loadOrder);
    assertValidationResult(validRes);
    if (validRes !== undefined) {
      throw new LoadOrderValidationError(validRes, loadOrder);
    }

    return Promise.resolve(undefined);
  } catch (err) {
    return Promise.reject(err);
  }
}

async function onStartUp(api: types.IExtensionApi, gameId: string): Promise<LoadOrder> {
  const state = api.getState();
  const profileId = selectors.lastActiveProfileForGame(state, gameId);
  const gameEntry: ILoadOrderGameInfo = findGameEntry(gameId);
  if ((gameEntry === undefined) || (profileId === undefined)) {
    const details = (gameEntry === undefined) ? { gameId } : { profileId };
    log('debug', 'invalid game entry or invalid profile', details);
    return Promise.resolve(undefined);
  }

  const prev = util.getSafe(state, ['persistent', 'loadOrder', profileId], []);
  try {
    const loadOrder = await gameEntry.deserializeLoadOrder();
    const validRes: IValidationResult = await gameEntry.validate(prev, loadOrder);
    assertValidationResult(validRes);
    if (validRes !== undefined) {
      throw new LoadOrderValidationError(validRes, loadOrder);
    }
    api.store.dispatch(setValidationResult(profileId, undefined));
    return Promise.resolve(loadOrder);
  } catch (err) {
    return errorHandler(api, gameId, err)
      .then(() => (err instanceof LoadOrderValidationError)
        ? Promise.reject(err) : Promise.resolve(undefined));
  }
}
