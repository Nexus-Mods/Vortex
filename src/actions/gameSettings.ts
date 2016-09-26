import { createAction } from 'redux-act';

/**
 * replace game settings. this happens when the game mode is changed
 */
export const setGameSettings = createAction('REPLACE_GAME_SETTINGS');

/**
 * change current profile
 */
export const setCurrentProfile = createAction('SET_CURRENT_PROFILE');
