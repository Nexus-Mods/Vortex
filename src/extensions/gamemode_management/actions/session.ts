import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

/**
 * sets the list of known/supported games
 */
export const setKnownGames = safeCreateAction('SET_KNOWN_GAMES', games => games);

export const clearGameDisabled = safeCreateAction('CLEAR_GAME_DISABLED');

export const setGameDisabled = safeCreateAction('SET_GAME_DISABLED',
  (gameId: string, disabledBy: string) => ({ gameId, disabledBy }));
