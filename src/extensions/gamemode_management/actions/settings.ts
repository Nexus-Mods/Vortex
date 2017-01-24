import { IDiscoveredTool } from '../../../types/IDiscoveredTool';

import { IDiscoveryResult } from '../types/IStateEx';

import safeCreateAction from '../../../actions/safeCreateAction';

/**
 * change game being managed
 */
export const setGameMode: any = safeCreateAction('SET_GAME_MODE');

/**
 * internal use only! Don't use outside gamemode_management
 */
export const setCurrentGameMode: any = safeCreateAction('SET_CURRENT_GAMEMODE');

/**
 * add info about a discovered game
 */
export const addDiscoveredGame: any =
  safeCreateAction('ADD_DISCOVERED_GAME',
    (id: string, result: IDiscoveryResult) => { return { id, result }; });

/**
 * add info about a discovered tool
 */
export const addDiscoveredTool: any =
  safeCreateAction('ADD_DISCOVERED_TOOL',
    (gameId: string, toolId: string, result: IDiscoveredTool) => {
      return { gameId, toolId, result };
    });

/**
 * change tool's info
 */
export const changeToolParams: any =
  safeCreateAction('CHANGE_TOOL_PARAMS',
    (toolId: string) => {
      return { toolId };
    });

/**
 * remove info about a discovered tool
 */
export const removeDiscoveredTool: any = safeCreateAction('REMOVE_DISCOVERED_TOOL',
    (gameId: string, toolId: string) => {
      return { gameId, toolId };
    });

/**
 * hide or unhide a game
 */
export const setGameHidden: any = safeCreateAction('SET_GAME_HIDDEN',
  (gameId: string, hidden: boolean) => { return { gameId, hidden }; });

/**
 * add a search path (path that is searched for game installations)
 */
export const addSearchPath: any = safeCreateAction('ADD_SEARCH_PATH');

/**
 * remove a search path
 */
export const removeSearchPath: any = safeCreateAction('REMOVE_SEARCH_PATH');
