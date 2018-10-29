import { IDeploymentMethod } from '../types/IDeploymentMethod';
import { IState } from '../../../types/IState';
import { getSafe } from '../../../util/storeHelper';
import { getGame } from '../../gamemode_management/util/getGame';
import allTypesSupported from './allTypesSupported';
import { activeGameId } from '../../profile_management/selectors';

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
  const modTypes = Object.keys(game.getModPaths(discovery.path));
  return activators.filter(
    act => allTypesSupported(act, state, gameId, modTypes) === undefined);
}

export function getCurrentActivator(state: IState, gameId: string, allowFallback: boolean): IDeploymentMethod {
  const activatorId = state.settings.mods.activator[gameId];

  let activator: IDeploymentMethod;
  if (activatorId !== undefined) {
    activator = activators.find((act: IDeploymentMethod) => act.id === activatorId);
  }

  const gameDiscovery =
    getSafe(state, ['settings', 'gameMode', 'discovered', gameId], undefined);
  const types = Object.keys(getGame(gameId).getModPaths(gameDiscovery.path));

  if (allowFallback && (allTypesSupported(activator, state, gameId, types) !== undefined)) {
    // if the selected activator is no longer supported, don't use it
    activator = undefined;
  }

  if (activator === undefined) {
    activator = activators.find(act =>
      allTypesSupported(act, state, gameId, types) === undefined);
  }

  return activator;
}

export function getActivator(activatorId: string): IDeploymentMethod {
  return activators.find(act => act.id === activatorId);
}
