import safeCreateAction from '../../../actions/safeCreateAction';
import { IDiscoveredTool } from '../../../types/IDiscoveredTool';

import { IDiscoveryResult } from '../types/IDiscoveryResult';

/**
 * add info about a discovered game
 */
export const addDiscoveredGame =
  safeCreateAction('ADD_DISCOVERED_GAME',
  (id: string, result: IDiscoveryResult) => ({ id, result }));

/**
 * override the path of a game that's already been discovered
 */
export const setGamePath = safeCreateAction('SET_GAME_PATH',
  (gameId: string, gamePath: string) => ({ gameId, gamePath }));

/**
 * add info about a discovered tool
 */
export const addDiscoveredTool =
  safeCreateAction('ADD_DISCOVERED_TOOL',
  (gameId: string, toolId: string, result: IDiscoveredTool) => ({ gameId, toolId, result }));

/**
 * set visibility of a tool. Tools that have been added by the user will be removed entirely whereas
 * discovered tools (those where we have code to discover them) are merely hidden
 */
export const setToolVisible = safeCreateAction('SET_TOOL_VISIBLE',
(gameId: string, toolId: string, visible: boolean) => ({ gameId, toolId, visible }));

/**
 * change parameters for a game (i.e. call arguments, environment, ...)
 */
export const setGameParameters = safeCreateAction('SET_GAME_PARAMETERS',
(gameId: string, parameters: any) => ({ gameId, parameters }));

/**
 * hide or unhide a game
 */
export const setGameHidden = safeCreateAction('SET_GAME_HIDDEN',
(gameId: string, hidden: boolean) => ({ gameId, hidden }));

/**
 * add a search path (path that is searched for game installations)
 */
export const addSearchPath = safeCreateAction('ADD_SEARCH_PATH');

/**
 * remove a search path
 */
export const removeSearchPath = safeCreateAction('REMOVE_SEARCH_PATH');

export const setPickerLayout = safeCreateAction('SET_GAMEPICKER_LAYOUT',
  (layout: 'list' | 'small' | 'large') => ({ layout }));
