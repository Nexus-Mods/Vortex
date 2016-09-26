import { IDiscoveryResult } from '../types/IState';

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
