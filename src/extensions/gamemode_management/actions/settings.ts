import { IDiscoveredTool } from '../../../types/IDiscoveredTool';

import { IDiscoveryResult } from '../types/IStateEx';

import { createAction } from 'redux-act';

/**
 * change game being managed
 */
export const setGameMode: any = createAction('SET_GAME_MODE');

/**
 * add info about a discovered game
 */
export const addDiscoveredGame: any =
  createAction('ADD_DISCOVERED_GAME',
    (id: string, result: IDiscoveryResult) => { return { id, result }; });

/**
 * add info about a discovered tool
 */
export const addDiscoveredTool: any =
  createAction('ADD_DISCOVERED_TOOL',
    (gameId: string, toolId: string, result: IDiscoveredTool) => {
      return { gameId, toolId, result };
    });

/**
 * change tool's info
 */
export const changeToolParams: any =
  createAction('CHANGE_TOOL_PARAMS',
    (toolId: string) => {
      return { toolId };
    });

/**
 * remove info about a discovered tool
 */
export const removeDiscoveredTool: any = createAction('REMOVE_DISCOVERED_TOOL',
    (gameId: string, toolId: string) => {
      return { gameId, toolId };
    });

/**
 * hide or unhide a game
 */
export const setGameHidden: any = createAction('SET_GAME_HIDDEN',
  (gameId: string, hidden: boolean) => { return { gameId, hidden }; });

/**
 * add a search path (path that is searched for game installations)
 */
export const addSearchPath: any = createAction('ADD_SEARCH_PATH');

/**
 * remove a search path
 */
export const removeSearchPath: any = createAction('REMOVE_SEARCH_PATH');
