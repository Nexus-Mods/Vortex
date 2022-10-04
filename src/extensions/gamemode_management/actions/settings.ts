import safeCreateAction from '../../../actions/safeCreateAction';
import { IDiscoveredTool } from '../../../types/IDiscoveredTool';

import { IDiscoveryResult } from '../types/IDiscoveryResult';

import * as reduxAct from 'redux-act';

const identity = input => input;

/**
 * add info about a discovered game
 */
export const addDiscoveredGame =
  safeCreateAction('ADD_DISCOVERED_GAME',
  (id: string, result: IDiscoveryResult) => ({ id, result }));

// undiscover game that's no longer found
export const clearDiscoveredGame = safeCreateAction('UNDISCOVER_GAME', (id: string) => ({ id }));

/**
 * override the path of a game that's already been discovered
 */
export const setGamePath = safeCreateAction('SET_GAME_PATH',
  (gameId: string, gamePath: string, store: string) => ({ gameId, gamePath, store }));

/**
 * add info about a discovered tool
 */
export const addDiscoveredTool =
  safeCreateAction('ADD_DISCOVERED_TOOL',
  (gameId: string, toolId: string, result: IDiscoveredTool, manual: boolean) =>
    ({ gameId, toolId, result, manual }));

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

export const setGameSearchPaths = safeCreateAction('SET_GAME_SEARCH_PATHS',
  (paths: string[]) => paths);

export const setPickerLayout = safeCreateAction('SET_GAMEPICKER_LAYOUT',
  (layout: 'list' | 'small' | 'large') => ({ layout }));

export const setSortManaged = safeCreateAction('SET_SORT_MANAGED', (order: string) => order);
export const setSortUnmanaged = safeCreateAction('SET_SORT_UNMANAGED', (order: string) => order);
