import { createAction } from 'redux-act';

/**
 * replace game settings. this happens when the game mode is changed
 */
export const setGameSettings = createAction('completely replaces current game settings');

export const setCurrentProfile = createAction('set the current profile');
