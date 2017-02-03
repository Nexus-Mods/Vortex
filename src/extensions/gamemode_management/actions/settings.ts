import safeCreateAction from '../../../actions/safeCreateAction';
import { IDiscoveredTool } from '../../../types/IDiscoveredTool';

import { IDiscoveryResult } from '../types/IDiscoveryResult';

/**
 * add info about a discovered game
 */
export const addDiscoveredGame: any =
  safeCreateAction('ADD_DISCOVERED_GAME',
  (id: string, result: IDiscoveryResult) => ({ id, result }));

/**
 * add info about a discovered tool
 */
export const addDiscoveredTool: any =
  safeCreateAction('ADD_DISCOVERED_TOOL',
  (gameId: string, toolId: string, result: IDiscoveredTool) => ({ gameId, toolId, result }));

/**
 * change tool's info
 */
export const changeToolParams: any =
  safeCreateAction('CHANGE_TOOL_PARAMS',
  (toolId: string) => ({ toolId }));

/**
 * remove info about a discovered tool
 */
export const removeDiscoveredTool: any = safeCreateAction('REMOVE_DISCOVERED_TOOL',
(gameId: string, toolId: string) => ({ gameId, toolId }));

/**
 * hide or unhide a game
 */
export const setGameHidden: any = safeCreateAction('SET_GAME_HIDDEN',
(gameId: string, hidden: boolean) => ({ gameId, hidden }));

/**
 * add a search path (path that is searched for game installations)
 */
export const addSearchPath: any = safeCreateAction('ADD_SEARCH_PATH');

/**
 * remove a search path
 */
export const removeSearchPath: any = safeCreateAction('REMOVE_SEARCH_PATH');
