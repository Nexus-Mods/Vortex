import { IState } from '../../../types/IState';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import { getGame } from '../../gamemode_management/util/getGame';
import { activeGameId } from '../../profile_management/selectors';

import { IDeploymentMethod } from '../types/IDeploymentMethod';

import allTypesSupported from './allTypesSupported';

const activators: IDeploymentMethod[] = [];

export function registerDeploymentMethod(activator: IDeploymentMethod) {
  activators.push(activator);
}

export function getAllActivators(): IDeploymentMethod[] {
  return activators;
}

/**
 * return only those activators that are supported based on the current state
 *
 * @param {*} state
 * @returns {IDeploymentMethod[]}
 */
export function getSupportedActivators(state: IState): IDeploymentMethod[] {
  const gameId = activeGameId(state);
  const discovery = state.settings.gameMode.discovered[gameId];
  if ((discovery === undefined) || (discovery.path === undefined)) {
    return [];
  }
  const game = getGame(gameId);
  if (game === undefined) {
    return [];
  }
  const modPaths = game.getModPaths(discovery.path);
  const modTypes = Object.keys(modPaths)
    .filter(typeId => truthy(modPaths[typeId]));
  return activators.filter(
    act => allTypesSupported(act, state, gameId, modTypes) === undefined);
}

export function getSelectedActivator(state: IState, gameId: string) {
  const activatorId = state.settings.mods.activator[gameId];

  return (activatorId !== undefined)
    ? activators.find((act: IDeploymentMethod) => act.id === activatorId)
    : undefined;
}

export function getCurrentActivator(state: IState,
                                    gameId: string,
                                    allowDefault: boolean): IDeploymentMethod {
  let activator: IDeploymentMethod = getSelectedActivator(state, gameId);

  const gameDiscovery =
    getSafe(state, ['settings', 'gameMode', 'discovered', gameId], undefined);
  const modPaths = getGame(gameId).getModPaths(gameDiscovery.path);
  const types = Object.keys(modPaths)
    .filter(typeId => truthy(modPaths[typeId]));

  if (allowDefault && (activator === undefined)) {
    const game = getGame(gameId);
    const discovery = state.settings.gameMode.discovered[gameId];
    if ((game !== undefined) && (discovery !== undefined)) {
      const modTypes = Object.keys(game.getModPaths(discovery.path));
      activator = activators.find(act =>
        allTypesSupported(act, state, gameId, modTypes) === undefined);
    }
  }

  if (activator === undefined) {
    return undefined;
  }

  if (allTypesSupported(activator, state, gameId, types) !== undefined) {
    // if the selected activator is no longer supported, don't use it
    return undefined;
  }

  return activator;
}

export function getActivator(activatorId: string): IDeploymentMethod {
  return activators.find(act => act.id === activatorId);
}
