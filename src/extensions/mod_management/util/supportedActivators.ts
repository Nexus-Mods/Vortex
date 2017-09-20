import {IState} from '../../../types/IState';
import { getGame } from '../../gamemode_management';
import { currentGameDiscovery } from '../../gamemode_management/selectors';
import { activeGameId } from '../../profile_management/selectors';
import { IDeploymentMethod } from '../types/IDeploymentMethod';

import allTypesSupported from './allTypesSupported';

/**
 * return only those activators that are supported based on the current state
 *
 * @param {*} state
 * @returns {IDeploymentMethod[]}
 */
function supportedActivators(activators: IDeploymentMethod[], state: IState): IDeploymentMethod[] {
  const gameId = activeGameId(state);
  const discovery = state.settings.gameMode.discovered[gameId];
  if (discovery === undefined) {
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

export default supportedActivators;
