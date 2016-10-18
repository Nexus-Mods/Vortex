import { IDiscoveryResult, IToolDiscoveryResult } from '../types/IStateEx';

import { createAction } from 'redux-act';

/**
 * change game being managed
 */
export const setGameMode = createAction('SET_GAME_MODE');

/**
 * add info about a discovered game
 */
export const addDiscoveredGame =
  createAction('ADD_DISCOVERED_GAME',
        (id: string, result: IDiscoveryResult) => { return { id, result }; });

/**
 * add info about a discovered tool
 */
export const addDiscoveredTool =
  createAction('ADD_DISCOVERED_TOOL',
        (gameId: string, toolId: string, result: IToolDiscoveryResult) => {
          return { gameId, toolId, result }; });

/**
 * remove info about a discovered tool
 */
export const hideDiscoveredTool =
  createAction('REMOVE_DISCOVERED_TOOL',
        (gameId: string, toolId: string) => {
          return { gameId, toolId }; });

/**
 * hide or unhide a game
 */
export const setGameHidden = createAction('SET_GAME_HIDDEN',
  (gameId: string, hidden: boolean) => { return { gameId, hidden }; });

/**
 * add a search path (path that is searched for game installations)
 */
export const addSearchPath = createAction('ADD_SEARCH_PATH');

/**
 * remove a search path
 */
export const removeSearchPath = createAction('REMOVE_SEARCH_PATH');
