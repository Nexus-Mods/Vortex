import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

/**
 * sets the list of known/supported games
 */
export const setKnownGames = safeCreateAction('SET_KNOWN_GAMES', games => games);
