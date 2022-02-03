import { IState } from '../../../types/IState';
import { getSafe } from '../../../util/storeHelper';
import { truthy } from '../../../util/util';
import { getGame } from '../../gamemode_management/util/getGame';
import { activeGameId } from '../../profile_management/selectors';

import { IDeploymentMethod } from '../types/IDeploymentMethod';

import allTypesSupported from './allTypesSupported';

const activators: IDeploymentMethod[] = [];

function byPriority(lhs: IDeploymentMethod, rhs: IDeploymentMethod) {
  return lhs.priority - rhs.priority;
}

export function registerDeploymentMethod(activator: IDeploymentMethod) {
  activators.push(activator);
  activators.sort(byPriority);
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
    act => allTypesSupported(act, state, gameId, modTypes).errors.length === 0);
}

export function getSelectedActivator(state: IState, gameId: string): IDeploymentMethod {
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
  if (gameDiscovery?.path === undefined) {
    // activator for a game that's not discovered doesn't really make sense
    return undefined;
  }
  const game = getGame(gameId);
  if (game?.getModPaths === undefined) {
    // Game is discovered but the gameModeManager isn't aware of it ?
    //  fantastic. https://github.com/Nexus-Mods/Vortex/issues/7079
    return undefined;
  }
  const modPaths = game.getModPaths(gameDiscovery.path);
  const types = Object.keys(modPaths)
    .filter(typeId => truthy(modPaths[typeId]));

  // if no activator has been selected for the game, allow using a default
  if (allowDefault && (activator === undefined)) {
    if ((game !== undefined) && (gameDiscovery?.path !== undefined)) {
      const modTypes = Object.keys(modPaths);

      const hadWarnings = [];

      activator = activators.find(act => {
        const problems =  allTypesSupported(act, state, gameId, modTypes);
        if (problems.errors.length === 0) {
          if (problems.warnings.length > 0) {
            hadWarnings.push(act);
          } else {
            return true;
          }
        }
        return false;
      });
      // prefer an activator without warnings but if there is none, use one with warnings
      if ((activator === undefined) && (hadWarnings.length > 0)) {
        activator = hadWarnings[0];
      }
    }
  }

  if (activator === undefined) {
    return undefined;
  }

  if (allTypesSupported(activator, state, gameId, types).errors.length !== 0) {
    // if the selected activator is no longer supported, don't use it
    return undefined;
  }

  return activator;
}

export function getActivator(activatorId: string): IDeploymentMethod {
  return activators.find(act => act.id === activatorId);
}
