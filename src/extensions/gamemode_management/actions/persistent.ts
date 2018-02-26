import safeCreateAction from '../../../actions/safeCreateAction';

import * as reduxAct from 'redux-act';

export const setGameInfo = safeCreateAction('SET_GAME_INFO',
  (gameId: string, provider: string, expires: number,
   values: Array<{ key: string, title: string, value: any }>) =>
    ({ gameId, provider, expires, values }));
