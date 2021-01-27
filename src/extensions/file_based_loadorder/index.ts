import { IExtensionContext } from '../../types/IExtensionContext';
import { ILoadOrderGameInfo, IValidationResult, LoadOrder,
  LoadOrderSerializationError, LoadOrderValidationError } from './types/types';

import FileBasedLoadOrderPage from './views/FileBasedLoadOrderPage';

import { modLoadOrderReducer } from './reducers/loadOrder';

import * as types from '../../types/api';
import * as util from '../../util/api';
import * as selectors from '../../util/selectors';

import { log } from '../../util/log';
import { setNewLoadOrder } from './actions/loadOrder';

const gameSupport: ILoadOrderGameInfo[] = [];

interface IDeployment {
  [modType: string]: types.IDeployedFile[];
}

interface IProfileState {
  [id: string]: types.IProfile;
}

async function errorHandler(api: types.IExtensionApi,
                            gameId: string,
                            err: Error) {
  const game = util.getGame(gameId);
  const allowReport = game.contributed === undefined;
  if (err instanceof LoadOrderValidationError) {
    const invalLOErr = err as LoadOrderValidationError;
    const errorMessage = 'Load order failed validation';
    const details = {
      message: errorMessage,
      loadOrder: invalLOErr.loadOrder,
      reasons: invalLOErr.validationResult.invalid.map(invl => `${invl.id} - ${invl.reason}\n`),
    };
    api.showErrorNotification(errorMessage, details, { allowReport });
  } else if (err instanceof LoadOrderSerializationError) {
    const serErr = err as LoadOrderSerializationError;
    const errMess = 'Failed to serialize load order';
    const details = {
      loadOrder: serErr.loadOrder,
    };
    api.showErrorNotification(errMess, details, { allowReport });
  } else {
    api.showErrorNotification('Failed load order operation', err, { allowReport });
  }

  return Promise.resolve();
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
      const prevLO: LoadOrder = util.getSafe(state, ['persistent', 'loadOrder', profile.id], []);
      const currentLO: LoadOrder = await gameEntry.deserializeLoadOrder();
      await applyNewLoadOrder(api, profile, prevLO, currentLO);
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

  if (newState[profile.id] === undefined) {
    // Profile removed.
    return;
  }

  const prevLO: LoadOrder = (oldState[profile.id] !== undefined)
    ? oldState[profile.id] : [];

  if (JSON.stringify(oldState[profile.id]) !== JSON.stringify(newState[profile.id])) {
    const loadOrder: LoadOrder = newState[profile.id];
    try {
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

  const prevLO = util.getSafe(state, ['persistent', 'loadOrder', profile.id], []);
  try {
    const loadOrder: LoadOrder = await gameEntry.deserializeLoadOrder();
    await applyNewLoadOrder(api, profile, prevLO, loadOrder);
  } catch (err) {
    // nop - any errors would've been reported by applyNewLoadOrder.
  }
}

async function genDeploymentEvent(api: types.IExtensionApi, profileId: string) {
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

  let deserializedLO: LoadOrder = [];
  const prevLO = util.getSafe(state, ['persistent', 'loadOrder', profile.id], []);
  try {
    deserializedLO = await gameEntry.deserializeLoadOrder();
    await applyNewLoadOrder(api, profile, prevLO, deserializedLO);
  } catch (err) {
    // nop - any errors would've been reported by applyNewLoadOrder.
  }
}

async function applyNewLoadOrder(api: types.IExtensionApi,
                                 profile: types.IProfile,
                                 prev: LoadOrder,
                                 newLO: LoadOrder): Promise<void> {
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

    await gameEntry.serializeLoadOrder(newLO);
    api.store.dispatch(setNewLoadOrder(profile.id, newLO));
  } catch (err) {
    return errorHandler(api, gameEntry.gameId, err);
  }

  return;
}

function genDidDeploy(api: types.IExtensionApi) {
  return async (profileId: string, deployment: IDeployment) =>
    genDeploymentEvent(api, profileId);
}

function genDidPurge(api: types.IExtensionApi) {
  return async (profileId: string, deployment: IDeployment) =>
    genDeploymentEvent(api, profileId);
}

export default function init(context: IExtensionContext) {
  context.registerMainPage('sort-none', 'Load Order', FileBasedLoadOrderPage, {
    id: 'file-based-loadorder',
    hotkey: 'E',
    group: 'per-game',
    visible: () => {
      const currentGameId: string = selectors.activeGameId(context.api.store.getState());
      const gameEntry: ILoadOrderGameInfo = findGameEntry(currentGameId);
      return (gameEntry !== undefined) ? true : false;
    },
    priority: 120,
    props: () => {
      return {
        getGameEntry: findGameEntry,
        applyLoadOrder: (profile: types.IProfile, prev: LoadOrder, newLO: LoadOrder) =>
          applyNewLoadOrder(context.api, profile, prev, newLO),
        onStartUp: (gameId: string) => onStartUp(context.api, gameId),
      };
    },
  });

  context.registerReducer(['persistent', 'loadOrder'], modLoadOrderReducer);

  context.registerLoadOrder = (gameInfo: ILoadOrderGameInfo) => {
    addGameEntry(gameInfo);
  };

  context.once(() =>  {
    context.api.onStateChange(['session', 'base', 'toolsRunning'],
      (prev, current) => genToolsRunning(context.api, prev, current));

    context.api.onStateChange(['persistent', 'loadOrder'],
      (prev, current) => genLoadOrderChange(context.api, prev, current));

    context.api.onStateChange(['persistent', 'profiles'],
      (prev, current) => genProfilesChange(context.api, prev, current));

    context.api.onAsync('did-deploy', genDidDeploy(context.api));
    context.api.onAsync('did-purge', genDidPurge(context.api));
  });

  return true;
}

async function onStartUp(api: types.IExtensionApi, gameId: string): Promise<LoadOrder> {
  const state = api.store.getState();
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

    return Promise.resolve(loadOrder);
  } catch (err) {
    return errorHandler(api, gameId, err)
      .then(() => (err instanceof LoadOrderValidationError)
        ? Promise.reject(err) : Promise.resolve(undefined));
  }
}

function assertValidationResult(validRes: any) {
  if (validRes === undefined) {
    return;
  }
  if ((Array.isArray(validRes)) || (validRes as IValidationResult)?.invalid === undefined) {
    throw new TypeError('Received incorrect/invalid return type from validation function; '
      + 'expected object of type IValidationResult');
  }
}

function addGameEntry(gameEntry: ILoadOrderGameInfo) {
  if (gameEntry === undefined) {
    log('error', 'unable to add load order page - invalid game entry');
    return;
  }

  const isDuplicate: boolean = gameSupport.find(game =>
    game.gameId === gameEntry.gameId) !== undefined;

  if (isDuplicate) {
    log('debug', 'attempted to add duplicate gameEntry to load order extension', gameEntry.gameId);
    return;
  }

  gameSupport.push(gameEntry);
}

function findGameEntry(gameId: string): ILoadOrderGameInfo {
  return gameSupport.find(game => game.gameId === gameId);
}
